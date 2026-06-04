# QAZRem

Веб-приложение для заявок на ремонт: адаптивный React-фронтенд, Node.js/Express API, PostgreSQL (Supabase) и уведомления через Telegram Bot API.

## Структура проекта

```
QAZRem/
├── backend/          # Node.js + Express + TypeScript API
│   ├── migrations/   # SQL-миграции (node-pg-migrate)
│   └── src/          # Исходный код
├── frontend/         # React + Vite + TypeScript (Vercel)
│   └── src/          # Исходный код
├── database/         # SQL-скрипты для инициализации БД
├── docs/             # Документация и ТЗ
├── docker-compose.yml # Для продакшена на VPS
├── .env              # Переменные окружения (в gitignore)
└── .env.example      # Шаблон .env
```

## Быстрый запуск

### 1. Настройка Supabase

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект.
2. В **Project Settings → Database** скопируйте **Connection string** (URI).
3. В **Project Settings → API** скопируйте **Project URL** (`SUPABASE_URL`) и **anon public key** (`SUPABASE_ANON_KEY`), а также **service_role key** (`SUPABASE_SERVICE_KEY`).

### 2. Настройка проекта

```bash
# Установить зависимости
npm install

# Скопировать .env и заполнить данными из Supabase
cp .env.example .env
```

Отредактируйте `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgres://postgres:password@aws-0-region.pooler.supabase.com:6543/postgres
```

### 3. Запустить миграции (создать таблицы)

```bash
npm run migrate:up
```

### 4. Запустить dev-серверы

```bash
npm run dev
```

После запуска:

- Frontend: http://localhost:5173
- API healthcheck: http://localhost:4000/health

## Telegram

Для отправки уведомлений заполните в `.env`:

```bash
TELEGRAM_BOT_TOKEN=123456:token
TELEGRAM_CHAT_ID=123456789
```

## Деплой

- **Frontend** — автоматический деплой на Vercel (подключить репозиторий)
- **API** — можно на Vercel (serverless functions) или на Render / Railway
- **Production DB** — при переходе на VPS: pg_dump из Supabase → импорт на свой сервер

## Миграции

```bash
# Применить все миграции
npm run migrate:up

# Откатить последнюю
npm run migrate:down

# Создать новую миграцию
npm run migrate:create my-migration-name
```
```

Если эти переменные пустые, API продолжит работать, но уведомления будут пропускаться.

## Структура

```text
apps/
  api/   Express API
  web/   React web/PWA-ready frontend
infra/
  postgres/init.sql
```
