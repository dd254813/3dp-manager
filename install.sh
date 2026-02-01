#!/usr/bin/env bash
set -euo pipefail

#################################
# КОНФИГУРАЦИЯ И ПЕРЕМЕННЫЕ
#################################
REPO_URL="https://github.com/denpiligrim/3dp-manager/archive/refs/heads/main.tar.gz"
PROJECT_DIR="/opt/3dp-manager"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

#################################
# ASCII-баннер
#################################
echo "==================================================="
echo "    ____             ____  _ ___            _         "
echo "   / __ \___  ____  / __ \(_) (_)___ ______(_)___ ___ "
echo "  / / / / _ \/ __ \/ /_/ / / / / __ \/ ___/ / __ \`__ \ "
echo " / /_/ /  __/ / / / ____/ / / / /_/ / /  / / / / / / /"
echo "/_____/\___/_/ /_/_/   /_/_/_/\__, /_/  /_/_/ /_/ /_/ "
echo "                             /____/                   "
echo ""
echo "              3DP-MANAGER FOR 3X-UI                "
echo "==================================================="
echo ""

#################################
# ПРОВЕРКИ И УСТАНОВКА ЗАВИСИМОСТЕЙ
#################################
if [[ $EUID -ne 0 ]]; then
   error "Этот скрипт должен быть запущен от имени root"
fi

. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    die "Этот скрипт поддерживает только Ubuntu или Debian: $ID"
fi

if [ $(free -m | grep Mem: | awk '{print $2}') -lt 2000 ]; then
    if [ $(free -m | grep Swap: | awk '{print $2}') -eq 0 ]; then
        log "Мало RAM и нет Swap. Создаем swap-файл 2GB..."
        fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        log "Swap создан."
    fi
fi

log "Проверка зависимостей..."
if ! command -v curl &> /dev/null; then apt-get update && apt-get install -y curl; fi
if ! command -v jq &> /dev/null; then apt-get install -y jq; fi
if ! command -v openssl &> /dev/null; then apt-get install -y openssl; fi
if ! command -v tar &> /dev/null; then apt-get install -y tar; fi
if ! command -v hostname &> /dev/null; then apt-get install -y net-tools || apt-get install -y hostname; fi

# Установка Docker
log "Проверка Docker"

if command -v docker >/dev/null 2>&1; then
    log "Docker уже установлен"
else
    log "Docker не найден, будет установлен из официального репозитория"
    # Add Docker's official GPG key:
    apt update
    apt install ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    if [[ "$ID" == "ubuntu" ]]; then
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || die "Ошибка добавления ключа Docker"
    else
        curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc || die "Ошибка добавления ключа Docker"
    fi
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources:
    CODENAME=${UBUNTU_CODENAME:-$VERSION_CODENAME}
    tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: $CODENAME
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

    apt update

    apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

#################################
# ЗАГРУЗКА ПРОЕКТА
#################################
log "Подготовка директории $PROJECT_DIR..."
mkdir -p "$PROJECT_DIR"

log "Скачивание последней версии проекта..."
curl -L "$REPO_URL" | tar xz -C "$PROJECT_DIR" --strip-components=1

cd "$PROJECT_DIR"

#################################
# СБОР ДАННЫХ
#################################
read -rp "Введите домен сервера (если пропустить, будет использоваться IP без HTTPS): " INPUT_HOST

USE_SSL=false
CERT_PATH=""
KEY_PATH=""
SKIP_SSL_SETUP=false

if [ -z "$INPUT_HOST" ]; then
    UI_HOST=$(hostname -I | awk '{print $1}')
    log "Домен не указан. Используется локальный IP: $UI_HOST"
    log "Режим HTTPS принудительно отключен для IP-адреса."
    
    USE_SSL=false
    SKIP_SSL_SETUP=true
else
    UI_HOST=$INPUT_HOST
    SKIP_SSL_SETUP=false
fi

# --- 2. Настройка SSL (Только если введен домен) ---
if [[ "$SKIP_SSL_SETUP" == "false" ]]; then
    # Пытаемся автоматически найти сертификаты Let's Encrypt
    LE_CERT="/etc/letsencrypt/live/$UI_HOST/fullchain.pem"
    LE_KEY="/etc/letsencrypt/live/$UI_HOST/privkey.pem"

    if [[ -f "$LE_CERT" && -f "$LE_KEY" ]]; then
        log "Найдены сертификаты Let's Encrypt."
        USE_SSL=true
        CERT_PATH="$LE_CERT"
        KEY_PATH="$LE_KEY"
    else
        # Спрашиваем пользователя, если авто-поиск не дал результата
        read -rp "Использовать SSL (свои сертификаты)? (y/n): " ssl_ans
        if [[ "$ssl_ans" =~ ^[Yy]$ ]]; then
            read -rp "Путь к fullchain.pem: " user_cert
            read -rp "Путь к privkey.pem: " user_key
            if [[ -f "$user_cert" && -f "$user_key" ]]; then
                USE_SSL=true
                CERT_PATH="$user_cert"
                KEY_PATH="$user_key"
            else
                warn "Файлы сертификатов не найдены. Будет использоваться HTTP."
            fi
        fi
    fi
fi

get_random_port() {
  while :; do
    PORT=$((RANDOM % 4000 + 3000))
    if ! ss -ltn | awk '{print $4}' | grep -q ":$PORT\$"; then
      echo "$PORT"
      return
    fi
  done
}
FINAL_PORT=$(get_random_port)

# --- 4. Генерация паролей ---
DB_PASS=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -base64 32)
log "Сгенерированы секретные ключи для БД и JWT."

#################################
# ГЕНЕРАЦИЯ ФАЙЛОВ DOCKER
#################################

# --- 1. Dockerfile для Client ---
cat > client/Dockerfile <<EOF
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx-client.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

# --- 3. Dockerfile для Server ---
cat > server/Dockerfile <<EOF
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/main"]
EOF

cat > server/.env <<EOF
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=${DB_PASS}
DB_NAME=3dp_manager
EOF

if [[ "$USE_SSL" == "true" ]]; then
    # === ВАРИАНТ С SSL ===
    
    # 1. Nginx Config
cat > client/nginx-client.conf <<EOF
server {
    listen $FINAL_PORT ssl;
    server_name $UI_HOST;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 50M;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
server {
    listen 3000 ssl;
    server_name $UI_HOST;
    client_max_body_size 50M;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location / {
        proxy_pass http://backend:3000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
services:
  postgres:
    image: postgres:18-alpine
    container_name: 3dp-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: 3dp_manager
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d 3dp_manager"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    build: ./server
    container_name: 3dp-backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: admin
      DB_PASSWORD: ${DB_PASS}
      DB_NAME: 3dp_manager
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    networks:
      - app-network

  frontend:
    build: ./client
    container_name: 3dp-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "${FINAL_PORT}:${FINAL_PORT}"
      - "3000:3000"
    volumes:
      - ${CERT_PATH}:/etc/nginx/certs/fullchain.pem:ro
      - ${KEY_PATH}:/etc/nginx/certs/privkey.pem:ro
    networks:
      - app-network

volumes:
  pg_data:

networks:
  app-network:
    driver: bridge
EOF

else
    # === ВАРИАНТ БЕЗ SSL (HTTP) ===
    
    # 1. Nginx Config
cat > client/nginx-client.conf <<EOF
server {
    listen ${FINAL_PORT};
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
server {
    listen 3000;
    server_name localhost;
    location / {
        proxy_pass http://backend:3000/;
        proxy_set_header Host \$host;
    }
}
EOF

    # 2. Docker Compose
cat > docker-compose.yml <<EOF
services:
  postgres:
    image: postgres:18-alpine
    container_name: 3dp-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: 3dp_manager
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d 3dp_manager"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  backend:
    build: ./server
    container_name: 3dp-backend
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: admin
      DB_PASSWORD: ${DB_PASS}
      DB_NAME: 3dp_manager
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    networks:
      - app-network

  frontend:
    build: ./client
    container_name: 3dp-frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "${FINAL_PORT}:${FINAL_PORT}"
      - "3000:3000"
    networks:
      - app-network

volumes:
  pg_data:

networks:
  app-network:
    driver: bridge
EOF
fi

#################################
# ЗАПУСК
#################################
log "Сборка и запуск контейнеров..."
# Останавливаем старые, если были
docker compose down --remove-orphans || true

# Запускаем сборку и старт
docker compose up --build -d

log "Очистка кэша сборки..."
docker image prune -f

echo ""
echo "==================================================="
if [[ "$USE_SSL" == "true" ]]; then
    echo -e "${GREEN}✔ Установка завершена! Доступно по адресу: https://${UI_HOST}:${FINAL_PORT}${NC}"
else
    echo -e "${GREEN}✔ Установка завершена! Доступно по адресу: http://${UI_HOST}:${FINAL_PORT}${NC}"
fi
echo "Логин: admin"
echo "Пароль: admin"
echo ""
echo "Немедленно измените пароль в Настройках утилиты!"
echo "==================================================="