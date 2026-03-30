#!/usr/bin/env bash
set -euo pipefail

#################################
# TRAP
#################################
trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

#################################
# HELPERS
#################################
log()  { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die()  { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

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

check_containers_running() {
  log "Проверка статуса контейнеров..."
  local timeout=${1:-60}
  local elapsed=0
  local failed=0
  
  while [ $elapsed -lt $timeout ]; do
    failed=0
    # Формат: NAME\tSTATUS (например: "3dp-postgres\tUp 2 days" или "3dp-postgres\tError")
    while IFS=$'\t' read -r container_name status; do
      if [ -n "$container_name" ]; then
        # Проверяем, что статус содержит running/healthy (Up, running, healthy, restarting)
        if ! echo "$status" | grep -qiE "(running|healthy|up[[:space:]]|restarting)"; then
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

need_root() {
  [[ $EUID -eq 0 ]] || die "Запускать только от root"
}

#################################
# CONFIG
#################################
PROJECT_DIR="/opt/3dp-manager"

#################################
# START
#################################
need_root

log "Обновление 3dp-manager"

[[ -d "$PROJECT_DIR" ]] || die "3dp-manager не установлен ($PROJECT_DIR не найден)"

cd "$PROJECT_DIR"

#################################
# CHECK DOCKER
#################################
command -v docker >/dev/null 2>&1 || die "Docker не установлен"
resolve_compose_cmd
log "Compose команда: ${COMPOSE_CMD[*]}"

#################################
# REBUILD BACKEND
#################################
log "Скачивание последних версий Docker-образов..."
if "${COMPOSE_CMD[@]}" pull; then
    log "Образы успешно загружены."
else
    die "Ошибка при скачивании образов. Проверьте подключение к интернету или доступность GitHub Container Registry."
fi

log "Пересоздание контейнеров..."
"${COMPOSE_CMD[@]}" up -d

# Проверка: все ли контейнеры запустились
if ! check_containers_running 60; then
    error "Не удалось запустить контейнеры. Логи:"
    "${COMPOSE_CMD[@]}" logs --tail=50
    die "Обновление прервано из-за ошибки запуска контейнеров"
fi

log "Очистка старых Docker-образов (освобождение места)..."
docker image prune -f

#################################
# DONE
#################################
log "3dp-manager успешно обновлён ✅"
