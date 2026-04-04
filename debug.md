# Локальная отладка 3dp-manager

> ⚠️ **Внимание:** Локальный стенд использует учётные данные `admin/admin` **только для разработки**. Production-скрипты (`install.sh`, `update.sh`) автоматически генерируют безопасные пароли.

## Порты локального стенда

| Сервис | Порт | Доступ |
|--------|------|--------|
| **frontend** | `http://localhost:8080` | ✅ Доступен из браузера |
| **backend API** | `http://backend:3100/api` | ❌ Скрыт внутри Docker network |
| **postgres** | `5432/tcp` | ❌ Скрыт внутри Docker network |

> 🔒 **Безопасность:** Backend и PostgreSQL не проброшены наружу — доступны только внутри Docker network.

## Учётные данные (по умолчанию)

**Локальный стенд (`.env`):**
```
ADMIN_LOGIN: admin
ADMIN_PASSWORD: admin
POSTGRES_USER: admin
POSTGRES_PASSWORD: admin
POSTGRES_DB: 3dp_manager
JWT_SECRET: localDevSecretKey12345678901234567890
```

> ⚠️ **Важно:** Для локальной разработки используется `admin/admin`. Production-скрипты автоматически генерируют случайные пароли при установке/обновлении.

## Запуск/перезапуск

### Полный запуск (с пересозданием volumes)
```powershell
# Первый запуск или полная пересборка
docker compose -f docker-compose.local.yml --env-file .env up -d --build --force-recreate

# Если нужно очистить БД и пересоздать volumes
docker compose -f docker-compose.local.yml --env-file .env down -v
docker compose -f docker-compose.local.yml --env-file .env up -d --build
```

### Частичный перезапуск
```powershell
# Только frontend (без пересборки)
docker compose -f docker-compose.local.yml --env-file .env restart frontend

# Только backend (без пересборки)
docker compose -f docker-compose.local.yml --env-file .env restart backend

# Frontend с пересборкой
docker compose -f docker-compose.local.yml --env-file .env up -d --build --no-deps frontend

# Backend с пересборкой
docker compose -f docker-compose.local.yml --env-file .env up -d --build --no-deps backend
```

### Статус контейнеров
```powershell
docker compose -f docker-compose.local.yml --env-file .env ps
```

### Просмотр логов
```powershell
# Backend логи
docker compose -f docker-compose.local.yml --env-file .env logs -f backend

# Frontend логи
docker compose -f docker-compose.local.yml --env-file .env logs -f frontend

# Последние 50 строк
docker compose -f docker-compose.local.yml --env-file .env logs --tail 50 backend
```

### Остановка
```powershell
# Остановка без удаления volumes
docker compose -f docker-compose.local.yml --env-file .env down

# Полная очистка (включая volumes)
docker compose -f docker-compose.local.yml --env-file .env down -v
```

## Быстрые проверки
```powershell
# Проверка frontend (должен вернуть 200)
curl --noproxy "*" -s -o /dev/null -w "%{http_code}" http://localhost:8080

# Проверка backend API через frontend-proxy (должен вернуть 401 без токена)
curl --noproxy "*" -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/settings

# Проверка login endpoint
curl --noproxy "*" -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"login":"admin","password":"admin"}'
```

## Тесты и линтинг

### Backend
```powershell
cd server
npm run lint
npm run test
npm run test:cov
```

### Frontend
```powershell
cd client
npm run lint
npm run test
npm run test:cov
```

## Что уже встроено
- Backend scanner (RealiTLScanner) собирается в `server/Dockerfile` и кладется в контейнер backend.
- Блок `Автопоиск SNI (backend scanner)` показывается только если бинарник сканера доступен в контейнере.
- Во время сканирования UI получает статус с backend (`/api/domains/scan/status`) и показывает реальный countdown.
- Если обновить страницу во время скана, UI подхватывает активный запуск по backend-статусу и продолжает отсчет.
- После завершения скана результат можно получить из backend (`/api/domains/scan/last-result`) даже если исходный запрос был прерван (например, после F5).
- Предварительный список сканера:
  - ручная проверка ссылками,
  - удаление позиций,
  - очистка,
  - экспорт в `.txt`,
  - сохранение состояния после F5.
- Основной список:
  - ссылки на домены,
  - hover-подсветка строк,
  - экспорт полного списка в `.txt`.

## Нормализация доменов (импорт и ручное добавление)
- Единые правила применяются и для загрузки файла, и для добавления по одному.
- `*.domain.com` нормализуется в `domain.com`.
- Комментарии и мусор отбрасываются (`#`, `;`, `//`, URL/пути/порты и т.п.).
- Дубликаты убираются без учета регистра.
- Явно некорректные значения отклоняются.

## Тестовый "больной" список
- Файл для проверки импорта: `checker/domains-import-fuzz.txt`

## Быстрые проверки
```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080
Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/settings
```

## Остановка
```powershell
docker compose -f docker-compose.local.yml down
```

## Перед PR

### 1. Проверка локального стенда
```powershell
# Убедиться, что все контейнеры работают
docker compose -f docker-compose.local.yml --env-file .env.local ps

# Проверить логи на наличие ошибок
docker compose -f docker-compose.local.yml --env-file .env.local logs --tail 100 backend
docker compose -f docker-compose.local.yml --env-file .env.local logs --tail 100 frontend

# Быстрый тест API
curl --noproxy "*" -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/settings
```

### 2. Прогнать тесты
```powershell
# Backend тесты
cd server
npm run test

# Frontend тесты
cd client
npm run test
```

### 3. Прогнать линтинг
```powershell
# Backend
cd server
npm run lint

# Frontend
cd client
npm run lint
```

### 4. Проверка изменений
```powershell
git status --short
git diff --name-only
```

Проверяем, что в PR идут только целевые изменения фичи.

## Обновление production (кастомная ветка)

> ⚠️ **Важно:** Начиная с версии 2.0.3, скрипты обновления автоматически проверяют и заменяют учётные данные по умолчанию (`admin/admin`) на безопасные. Новые пароли выводятся в лог при обновлении.

Для сервера, где `bash <(curl ...)` не работает из-за `/dev/fd`, используем пайп:

```bash
curl -fsSL https://raw.githubusercontent.com/iqubik/3dp-manager/dp-fix/update-custom.sh | bash -s -- -r https://github.com/iqubik/3dp-manager.git -b dp-fix
```

Что делает команда:
- подтягивает исходники из `iqubik/3dp-manager` ветки `dp-fix` в `/opt/3dp-manager-src`,
- собирает `backend/frontend` из этих исходников,
- поднимает контейнеры через `docker-compose.custom.yml` поверх текущей установки в `/opt/3dp-manager`.

Проверка после обновления:

```bash
cd /opt/3dp-manager
docker compose -f docker-compose.yml -f docker-compose.custom.yml ps
docker compose -f docker-compose.yml -f docker-compose.custom.yml logs --tail 120 backend
docker compose -f docker-compose.yml -f docker-compose.custom.yml logs --tail 120 frontend
```

Ожидаемо и нормально в логах frontend:
- `can not modify /etc/nginx/conf.d/default.conf (read-only file system?)`

Это штатно при `:ro`-монтировании nginx-конфига.

## Полная custom-установка на VPS (dp-custom)

> ⚠️ **Важно:** Скрипт `install-custom.sh` автоматически генерирует безопасные пароли при установке. Учётные данные выводятся в лог после установки — сохраните их!

Сценарий "с нуля или поверх существующей установки":

```bash
curl -fsSL https://raw.githubusercontent.com/iqubik/3dp-manager/dp-custom/install-custom.sh | bash -s -- -r https://github.com/iqubik/3dp-manager.git -b dp-custom
```

Только обновление custom-кода (без базовой установки):

```bash
curl -fsSL https://raw.githubusercontent.com/iqubik/3dp-manager/dp-custom/update-custom.sh | bash -s -- -r https://github.com/iqubik/3dp-manager.git -b dp-custom
```

## Git workflow: dp-custom -> dp-fix -> автор
Роли веток:
- `dp-custom`: рабочая ветка для всех локальных/продовых/вспомогательных правок (включая `update-custom.sh`, `debug.md`, `pub.md`).
- `dp-fix`: чистая ветка для PR в репозиторий автора (только код, который должен попасть upstream).

Почему GitHub Desktop "не даёт":
- Он не всегда удобно поддерживает сценарий "перенос отдельных коммитов между ветками одного репо".
- Для этого используем terminal и `cherry-pick`.

Базовый цикл работы:

```bash
# 1) Работаем в dp-custom
git checkout dp-custom
# ... правки ...
git add .
git commit -m "feat: ... / fix: ..."
git push origin dp-custom
```

Проверка прода из `dp-custom`:

```bash
curl -fsSL https://raw.githubusercontent.com/iqubik/3dp-manager/dp-custom/update-custom.sh | bash -s -- -r https://github.com/iqubik/3dp-manager.git -b dp-custom
```

Перенос только нужных коммитов в `dp-fix`:

```bash
# 2) Смотрим, что нового в dp-custom относительно dp-fix
git log --oneline dp-fix..dp-custom

# 3) Переходим в чистую ветку PR
git checkout dp-fix

# 4) Переносим только нужные коммиты
git cherry-pick <commit_sha_1> <commit_sha_2> ...

# 5) Пушим чистую ветку и обновляем PR автору
git push origin dp-fix
```

Если конфликт при cherry-pick:

```bash
git status
# исправить конфликтные файлы
git add <resolved_files>
git cherry-pick --continue
```

Если нужно отменить текущий перенос:

```bash
git cherry-pick --abort
```

Проверка перед push в `dp-fix`:

```bash
git status --short
git diff --name-only upstream/dp-fix..HEAD
```

Ожидаем в `dp-fix` только те файлы, которые должны уйти автору.

## Файл .env.local

Файл `.env.local` в корне проекта содержит переменные окружения для локального стенда:

```bash
# Локальные учётные данные для разработки
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin
POSTGRES_DB=3dp_manager
JWT_SECRET=localDevSecretKey12345678901234567890
ADMIN_LOGIN=admin
ADMIN_PASSWORD=admin
PORT=3100
ALLOWED_ORIGINS=http://localhost:8080,http://localhost
```

> ⚠️ **Не коммитьте `.env.local` в репозиторий!** Файл должен быть добавлен в `.gitignore` для безопасности.

### Изменение учётных данных

Если нужно изменить логин/пароль для локальной разработки:

1. Отредактируйте `.env.local`
2. Пересоздайте контейнеры с очисткой volumes:
   ```powershell
   docker compose -f docker-compose.local.yml --env-file .env.local down -v
   docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
   ```
