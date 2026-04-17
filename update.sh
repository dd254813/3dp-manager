#!/usr/bin/env bash
set -euo pipefail

trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die() { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

PROJECT_DIR="/opt/3dp-manager"
SOURCE_CHANNEL_FILE="${PROJECT_DIR}/.3dp-source-channel"
MIN_BUILD_FREE_GB="${MIN_BUILD_FREE_GB:-5}"
COMPOSE_CMD=()
DOWNLOADED_SOURCE_DIR=""
DOWNLOADED_SOURCE_ROOT=""

need_root() {
  [[ $EUID -eq 0 ]] || die "Запускать только от root"
}

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=("docker" "compose")
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=("docker-compose")
    return 0
  fi

  die "Не найден Docker Compose (ни v2 plugin, ни v1 binary)"
}

ensure_common_tools() {
  local packages=()

  command -v curl >/dev/null 2>&1 || packages+=(curl)
  command -v tar >/dev/null 2>&1 || packages+=(tar)
  command -v rsync >/dev/null 2>&1 || packages+=(rsync)
  command -v awk >/dev/null 2>&1 || packages+=(gawk)
  command -v sed >/dev/null 2>&1 || packages+=(sed)

  if [[ ${#packages[@]} -gt 0 ]]; then
    apt-get update
    apt-get install -y "${packages[@]}"
  fi
}

cleanup_docker_build_cache() {
  log "Очищаю dangling build cache Docker перед сборкой"
  docker builder prune -f >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
}

storage_paths() {
  local docker_root
  docker_root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)
  [[ -n "$docker_root" ]] && echo "$docker_root"
  [[ -d "/var/lib/containerd" ]] && echo "/var/lib/containerd"
  echo "$PROJECT_DIR"
}

available_kb_for_path() {
  local path="$1"
  df -Pk "$path" 2>/dev/null | awk 'NR==2 { print $4 }'
}

ensure_build_headroom() {
  local required_gb="${1:-5}"
  local required_kb=$((required_gb * 1024 * 1024))
  local free_kb=""
  local path
  local current_free

  for path in $(storage_paths | awk '!seen[$0]++'); do
    current_free=$(available_kb_for_path "$path")
    [[ -n "$current_free" ]] || continue
    if [[ -z "$free_kb" || "$current_free" -lt "$free_kb" ]]; then
      free_kb="$current_free"
    fi
  done

  [[ -n "$free_kb" ]] || die "Не удалось определить свободное место на файловой системе"

  local free_gb=$((free_kb / 1024 / 1024))
  log "Свободно перед сборкой: ~${free_gb} GB"

  if (( free_kb < required_kb )); then
    docker system df || true
    die "Недостаточно свободного места для сборки. Нужно хотя бы ${required_gb} GB. Освободите место и повторите запуск."
  fi
}

check_containers_running() {
  log "Проверка статуса контейнеров..."
  local timeout=${1:-60}
  local elapsed=0
  local failed=0

  while [ $elapsed -lt $timeout ]; do
    failed=0
    while IFS=$'\t' read -r container_name status; do
      if [ -n "$container_name" ] && [ -n "$status" ]; then
        if ! echo "$status" | grep -qiE "^up|running|healthy|restarting"; then
          failed=1
          warn "Контейнер $container_name в статусе: $status"
        fi
      fi
    done < <("${COMPOSE_CMD[@]}" ps --format "table {{.Name}}\t{{.Status}}" --all 2>/dev/null | tail -n +2)

    if [ $failed -eq 0 ]; then
      log "Все контейнеры запущены успешно"
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

ensure_nginx_api_timeouts() {
  local nginx_conf="$1"
  [[ -f "$nginx_conf" ]] || return 0

  local tmp_file
  tmp_file="$(mktemp)"

  awk '
    BEGIN { in_api = 0; in_bus = 0; injected = 0 }
    {
      line = $0

      if (line ~ /^[[:space:]]*location[[:space:]]+\/api\/[[:space:]]*\{/) {
        in_api = 1
        in_bus = 0
        injected = 0
      }

      if (line ~ /^[[:space:]]*location[[:space:]]+\/bus\/[[:space:]]*\{/) {
        in_bus = 1
        in_api = 0
        injected = 0
      }

      if ((in_api || in_bus) && line ~ /proxy_(connect|send|read)_timeout[[:space:]]+[0-9]+s;/) {
        next
      }

      print line

      if ((in_api || in_bus) && line ~ /proxy_set_header[[:space:]]+X-Forwarded-For[[:space:]]+/ && injected == 0) {
        print "        proxy_connect_timeout 10s;"
        print "        proxy_send_timeout 650s;"
        print "        proxy_read_timeout 650s;"
        injected = 1
      }

      if ((in_api || in_bus) && line ~ /^[[:space:]]*}/) {
        in_api = 0
        in_bus = 0
        injected = 0
      }
    }
  ' "$nginx_conf" > "$tmp_file"

  mv "$tmp_file" "$nginx_conf"
}

ensure_bus_location() {
  local nginx_conf="$1"
  [[ -f "$nginx_conf" ]] || return 0

  if grep -q "location /bus/" "$nginx_conf"; then
    return 0
  fi

  local tmp_file
  tmp_file="$(mktemp)"

  awk '
    {
      print $0
      if ($0 ~ /^[[:space:]]*location[[:space:]]+\/api\//) {
        found_api = 1
      }
      if (found_api && $0 ~ /^[[:space:]]*}/) {
        print ""
        print "    location /bus/ {"
        print "        proxy_pass http://backend:3100/bus/;"
        print "        proxy_set_header Host $http_host;"
        print "        proxy_set_header X-Real-IP $remote_addr;"
        print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
        print "        proxy_set_header X-Forwarded-Proto $scheme;"
        print "        proxy_connect_timeout 10s;"
        print "        proxy_send_timeout 650s;"
        print "        proxy_read_timeout 650s;"
        print "    }"
        found_api = 0
      }
    }
  ' "$nginx_conf" > "$tmp_file"

  mv "$tmp_file" "$nginx_conf"
}

read_env_file_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true
}

read_compose_value() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0

  local value=""
  value=$(grep -E "^[[:space:]]+${key}:" "$file" 2>/dev/null | head -n 1 | sed -E 's/^[[:space:]]+'"$key"':[[:space:]]*//' | tr -d '"' | tr -d "'" || true)

  if [[ -z "$value" ]]; then
    value=$(grep -E "^[[:space:]]*-[[:space:]]*${key}=" "$file" 2>/dev/null | head -n 1 | sed -E 's/^[[:space:]]*-[[:space:]]*'"$key"'=//' | tr -d '"' | tr -d "'" || true)
  fi

  if [[ "$value" =~ ^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$ ]]; then
    local ref_key="${BASH_REMATCH[1]}"
    local env_value=""
    env_value=$(read_env_file_value "$ref_key" "${PROJECT_DIR}/.env")
    if [[ -z "$env_value" ]]; then
      env_value="${!ref_key:-}"
    fi
    value="$env_value"
  fi

  echo "$value"
}

resolve_config_value() {
  local key="$1"
  local default_value="$2"
  local value=""

  value=$(read_env_file_value "$key" "${PROJECT_DIR}/.env")
  if [[ -z "$value" ]]; then
    value=$(read_compose_value "$key" "${PROJECT_DIR}/docker-compose.yml")
  fi
  if [[ -z "$value" ]]; then
    value="$default_value"
  fi

  echo "$value"
}

backup_database() {
  local backup_dir="$1"
  local db_user
  local db_pass
  local db_name

  db_user=$(resolve_config_value "POSTGRES_USER" "admin")
  db_pass=$(resolve_config_value "POSTGRES_PASSWORD" "")
  db_name=$(resolve_config_value "POSTGRES_DB" "3dp_manager")

  if "${COMPOSE_CMD[@]}" exec -T -e PGPASSWORD="$db_pass" postgres pg_dump -U "$db_user" -d "$db_name" > "${backup_dir}/postgres.sql" 2>/dev/null; then
    log "SQL backup сохранён: ${backup_dir}/postgres.sql"
  else
    warn "Не удалось создать SQL backup. Продолжаем без него."
    rm -f "${backup_dir}/postgres.sql"
  fi
}

load_source_channel() {
  [[ -f "$SOURCE_CHANNEL_FILE" ]] || return 1
  # shellcheck disable=SC1090
  source "$SOURCE_CHANNEL_FILE"
  [[ -n "${SOURCE_CHANNEL_REPO:-}" ]] || return 1
  SOURCE_CHANNEL_REF="${SOURCE_CHANNEL_REF:-main}"
  return 0
}

ensure_local_nginx_client_conf() {
  local project_nginx_conf="${PROJECT_DIR}/client/nginx-client.conf"
  local source_nginx_conf="${DOWNLOADED_SOURCE_DIR}/client/nginx-client.conf"
  local source_fallback_conf="${DOWNLOADED_SOURCE_DIR}/client/nginx.conf"

  if [[ -f "$project_nginx_conf" ]]; then
    return 0
  fi

  mkdir -p "${PROJECT_DIR}/client"
  if [[ -f "$source_nginx_conf" ]]; then
    cp "$source_nginx_conf" "$project_nginx_conf"
  elif [[ -f "$source_fallback_conf" ]]; then
    cp "$source_fallback_conf" "$project_nginx_conf"
  fi
}

convert_compose_to_source_build() {
  local compose_file="$1"
  local tmp_file
  tmp_file="$(mktemp)"

  awk '
    function insert_build(service_name) {
      if (service_name == "backend" && inserted == 0) {
        print "    build: ./server"
        inserted = 1
      }
      if (service_name == "frontend" && inserted == 0) {
        print "    build: ./client"
        inserted = 1
      }
    }
    {
      if ($0 ~ /^  backend:[[:space:]]*$/) {
        section = "backend"
        inserted = 0
        print
        next
      }
      if ($0 ~ /^  frontend:[[:space:]]*$/) {
        section = "frontend"
        inserted = 0
        print
        next
      }
      if ($0 ~ /^  [A-Za-z0-9_-]+:[[:space:]]*$/ && $0 !~ /^  (backend|frontend):[[:space:]]*$/) {
        section = ""
        inserted = 0
      }
      if (section == "backend" || section == "frontend") {
        if ($0 ~ /^    image:[[:space:]]*/) {
          insert_build(section)
          next
        }
        if ($0 ~ /^    build:[[:space:]]*/) {
          inserted = 1
          print
          next
        }
        if (inserted == 0 && $0 ~ /^    [^[:space:]]/) {
          insert_build(section)
        }
      }
      print
    }
  ' "$compose_file" > "$tmp_file"

  mv "$tmp_file" "$compose_file"
}

download_source_archive() {
  local repo="$1"
  local ref="$2"

  DOWNLOADED_SOURCE_ROOT="$(mktemp -d)"
  local archive_path="${DOWNLOADED_SOURCE_ROOT}/source.tar.gz"

  if ! curl -fsSL "https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}" -o "$archive_path"; then
    curl -fsSL "https://codeload.github.com/${repo}/tar.gz/${ref}" -o "$archive_path"
  fi

  tar -xzf "$archive_path" -C "$DOWNLOADED_SOURCE_ROOT"
  DOWNLOADED_SOURCE_DIR=$(find "$DOWNLOADED_SOURCE_ROOT" -mindepth 1 -maxdepth 1 -type d | head -n 1)
  [[ -n "$DOWNLOADED_SOURCE_DIR" ]] || die "Не удалось распаковать исходники ${repo}@${ref}"
}

sync_source_tree() {
  [[ -n "$DOWNLOADED_SOURCE_DIR" ]] || die "Каталог с исходниками не подготовлен"

  rsync -a --delete \
    --exclude '.git' \
    --exclude 'docker-compose.yml' \
    --exclude '.env' \
    --exclude 'server/.env' \
    --exclude 'client/nginx-client.conf' \
    --exclude 'update.sh' \
    --exclude 'migrate_to_fork.sh' \
    --exclude '.3dp-source-channel' \
    "${DOWNLOADED_SOURCE_DIR}/" "${PROJECT_DIR}/"

  if [[ -f "${DOWNLOADED_SOURCE_DIR}/update.sh" ]]; then
    cp "${DOWNLOADED_SOURCE_DIR}/update.sh" "${PROJECT_DIR}/update.sh.next"
  fi
  if [[ -f "${DOWNLOADED_SOURCE_DIR}/migrate_to_fork.sh" ]]; then
    cp "${DOWNLOADED_SOURCE_DIR}/migrate_to_fork.sh" "${PROJECT_DIR}/migrate_to_fork.sh"
    chmod +x "${PROJECT_DIR}/migrate_to_fork.sh"
  fi
}

finalize_self_update() {
  if [[ -f "${PROJECT_DIR}/update.sh.next" ]]; then
    mv "${PROJECT_DIR}/update.sh.next" "${PROJECT_DIR}/update.sh"
    chmod +x "${PROJECT_DIR}/update.sh"
  fi
}

run_source_update() {
  log "Обнаружен source-канал: ${SOURCE_CHANNEL_REPO}@${SOURCE_CHANNEL_REF}"
  ensure_common_tools

  local backup_dir="${PROJECT_DIR}/backups/update-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup_dir"
  backup_database "$backup_dir"

  download_source_archive "$SOURCE_CHANNEL_REPO" "$SOURCE_CHANNEL_REF"
  sync_source_tree
  ensure_local_nginx_client_conf
  convert_compose_to_source_build "${PROJECT_DIR}/docker-compose.yml"
  ensure_nginx_api_timeouts "${PROJECT_DIR}/client/nginx-client.conf"
  ensure_bus_location "${PROJECT_DIR}/client/nginx-client.conf"

  cd "$PROJECT_DIR"
  cleanup_docker_build_cache
  ensure_build_headroom "$MIN_BUILD_FREE_GB"
  "${COMPOSE_CMD[@]}" pull postgres || true
  "${COMPOSE_CMD[@]}" build --pull backend frontend
  "${COMPOSE_CMD[@]}" up -d --remove-orphans

  if ! check_containers_running 120; then
    "${COMPOSE_CMD[@]}" logs --tail=100
    die "Не удалось запустить контейнеры после source update"
  fi

  docker image prune -f >/dev/null 2>&1 || true
  finalize_self_update
  log "Source update завершён успешно"
}

run_legacy_update() {
  log "Обновление legacy image-based установки"
  ensure_nginx_api_timeouts "${PROJECT_DIR}/client/nginx-client.conf"
  ensure_bus_location "${PROJECT_DIR}/client/nginx-client.conf"

  cd "$PROJECT_DIR"
  "${COMPOSE_CMD[@]}" pull
  "${COMPOSE_CMD[@]}" up -d
  "${COMPOSE_CMD[@]}" restart frontend || true

  if ! check_containers_running 60; then
    "${COMPOSE_CMD[@]}" logs --tail=100
    die "Не удалось запустить контейнеры после обновления"
  fi

  docker image prune -f >/dev/null 2>&1 || true
  log "Legacy update завершён успешно"
}

need_root
[[ -d "$PROJECT_DIR" ]] || die "3dp-manager не установлен (${PROJECT_DIR} не найден)"
command -v docker >/dev/null 2>&1 || die "Docker не установлен"
resolve_compose_cmd
log "Compose команда: ${COMPOSE_CMD[*]}"

if load_source_channel; then
  run_source_update
else
  run_legacy_update
fi
