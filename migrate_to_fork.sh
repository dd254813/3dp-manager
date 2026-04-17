#!/usr/bin/env bash
set -euo pipefail

trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die() { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

PROJECT_DIR="/opt/3dp-manager"
BACKUP_ROOT="/opt/3dp-manager-backups"
TARGET_REPO="${TARGET_REPO:-dd254813/3dp-manager}"
TARGET_REF="${TARGET_REF:-main}"
DEPLOY_MODE="${DEPLOY_MODE:-build}"
SOURCE_CHANNEL_FILE="${PROJECT_DIR}/.3dp-source-channel"
MIN_BUILD_FREE_GB="${MIN_BUILD_FREE_GB:-5}"
SERVICES_TO_BUILD="${SERVICES_TO_BUILD:-backend frontend}"
COMPOSE_CMD=()
DOWNLOADED_SOURCE_DIR=""
DOWNLOADED_SOURCE_ROOT=""
TARGET_IMAGE_TAG="${TARGET_IMAGE_TAG:-${TARGET_REF}}"

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

is_compose_v1() {
  [[ "${COMPOSE_CMD[0]}" == "docker-compose" ]]
}

remove_stale_service_containers() {
  is_compose_v1 || return 0

  local ids=()
  local id
  while read -r id; do
    [[ -n "$id" ]] && ids+=("$id")
  done < <(
    {
      docker ps -aq --filter "name=3dp-postgres"
      docker ps -aq --filter "name=3dp-backend"
      docker ps -aq --filter "name=3dp-frontend"
    } | awk '!seen[$0]++'
  )

  if [[ ${#ids[@]} -gt 0 ]]; then
    log "Удаляю stale контейнеры перед up для docker-compose v1"
    docker rm -f "${ids[@]}" >/dev/null 2>&1 || true
  fi
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

backup_current_files() {
  local backup_dir="$1"

  mkdir -p "$backup_dir/project"

  [[ -f "${PROJECT_DIR}/docker-compose.yml" ]] && cp -a "${PROJECT_DIR}/docker-compose.yml" "${backup_dir}/project/docker-compose.yml.bak"
  [[ -f "${PROJECT_DIR}/.env" ]] && cp -a "${PROJECT_DIR}/.env" "${backup_dir}/project/.env.bak"
  [[ -f "${PROJECT_DIR}/server/.env" ]] && cp -a "${PROJECT_DIR}/server/.env" "${backup_dir}/project/server.env.bak"
  [[ -f "${PROJECT_DIR}/client/nginx-client.conf" ]] && cp -a "${PROJECT_DIR}/client/nginx-client.conf" "${backup_dir}/project/nginx-client.conf.bak"
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

channel_repo_slug() {
  echo "${TARGET_REPO}"
}

image_backend_ref() {
  echo "ghcr.io/$(channel_repo_slug)-server:${TARGET_IMAGE_TAG}"
}

image_frontend_ref() {
  echo "ghcr.io/$(channel_repo_slug)-client:${TARGET_IMAGE_TAG}"
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

convert_compose_to_fork_images() {
  local compose_file="$1"
  local tmp_file
  local backend_image
  local frontend_image
  backend_image="$(image_backend_ref)"
  frontend_image="$(image_frontend_ref)"
  tmp_file="$(mktemp)"

  awk -v backend_image="$backend_image" -v frontend_image="$frontend_image" '
    function insert_image(service_name) {
      if (inserted == 0) {
        if (service_name == "backend") {
          print "    image: " backend_image
        }
        if (service_name == "frontend") {
          print "    image: " frontend_image
        }
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
        if ($0 ~ /^    image:[[:space:]]*/ || $0 ~ /^    build:[[:space:]]*/) {
          insert_image(section)
          next
        }
        if (inserted == 0 && $0 ~ /^    [^[:space:]]/) {
          insert_image(section)
        }
      }
      print
    }
  ' "$compose_file" > "$tmp_file"

  mv "$tmp_file" "$compose_file"
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
    cp "${DOWNLOADED_SOURCE_DIR}/update.sh" "${PROJECT_DIR}/update.sh"
    chmod +x "${PROJECT_DIR}/update.sh"
  fi
  if [[ -f "${DOWNLOADED_SOURCE_DIR}/migrate_to_fork.sh" ]]; then
    cp "${DOWNLOADED_SOURCE_DIR}/migrate_to_fork.sh" "${PROJECT_DIR}/migrate_to_fork.sh"
    chmod +x "${PROJECT_DIR}/migrate_to_fork.sh"
  fi
}

write_source_channel() {
  cat > "$SOURCE_CHANNEL_FILE" <<EOF
SOURCE_CHANNEL_REPO=${TARGET_REPO}
SOURCE_CHANNEL_REF=${TARGET_REF}
SOURCE_CHANNEL_MODE=${DEPLOY_MODE}
SOURCE_CHANNEL_IMAGE_TAG=${TARGET_IMAGE_TAG}
EOF
}

build_services_sequentially() {
  local service
  for service in $SERVICES_TO_BUILD; do
    log "Собираю сервис: ${service}"
    "${COMPOSE_CMD[@]}" build --pull "$service"
    docker builder prune -f >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
  done
}

need_root
[[ -d "$PROJECT_DIR" ]] || die "3dp-manager не установлен (${PROJECT_DIR} не найден)"
[[ -f "${PROJECT_DIR}/docker-compose.yml" ]] || die "Не найден ${PROJECT_DIR}/docker-compose.yml"
command -v docker >/dev/null 2>&1 || die "Docker не установлен"

ensure_common_tools
resolve_compose_cmd
log "Compose команда: ${COMPOSE_CMD[*]}"

BACKUP_DIR="${BACKUP_ROOT}/migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

log "Создаю backup текущей установки"
backup_current_files "$BACKUP_DIR"
backup_database "$BACKUP_DIR"

log "Скачиваю исходники ${TARGET_REPO}@${TARGET_REF}"
download_source_archive "$TARGET_REPO" "$TARGET_REF"

log "Копирую новую версию поверх текущей установки"
sync_source_tree
ensure_local_nginx_client_conf
ensure_nginx_api_timeouts "${PROJECT_DIR}/client/nginx-client.conf"
ensure_bus_location "${PROJECT_DIR}/client/nginx-client.conf"
write_source_channel

cd "$PROJECT_DIR"
if [[ "$DEPLOY_MODE" == "images" ]]; then
  convert_compose_to_fork_images "${PROJECT_DIR}/docker-compose.yml"
  log "Мигрирую в image-режим: $(image_backend_ref) и $(image_frontend_ref)"
  docker pull "$(image_backend_ref)"
  docker pull "$(image_frontend_ref)"
  "${COMPOSE_CMD[@]}" pull postgres || true
  remove_stale_service_containers
  "${COMPOSE_CMD[@]}" up -d --remove-orphans
else
  convert_compose_to_source_build "${PROJECT_DIR}/docker-compose.yml"
  cleanup_docker_build_cache
  ensure_build_headroom "$MIN_BUILD_FREE_GB"
  log "Пересобираю backend/frontend уже из исходников форка"
  "${COMPOSE_CMD[@]}" pull postgres || true
  build_services_sequentially
  remove_stale_service_containers
  "${COMPOSE_CMD[@]}" up -d --remove-orphans
fi

if ! check_containers_running 120; then
  "${COMPOSE_CMD[@]}" logs --tail=100
  die "Не удалось запустить контейнеры после миграции"
fi

docker image prune -f >/dev/null 2>&1 || true

log "Миграция завершена"
log "Backup сохранён в: ${BACKUP_DIR}"
log "Дальше используйте локальный update.sh или raw update.sh из этого форка"
