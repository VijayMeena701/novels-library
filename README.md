# novels-library

Personal web book catalog, reader, and archive.

## Branches and releases

- Use `ver_*` branches for releases, e.g. `ver_0.0.1`, `ver_1.0.0`.
- Open a pull request against a `ver_*` branch to trigger the `CI` workflow.
- Merging a PR does **not** deploy automatically; run the `Deploy to AWS` workflow manually from the release branch.
- When migrating data, run the backend `npm run deploy` pipeline to create pre/post backups, run migrations, seed RBAC constants, and verify document counts.

## Overview

novels-library (branded as **Books Library**) is a personal web book catalog, reader, and archiver. It tracks reading progress, scrapes and archives chapters, offers a clean TTS-capable reader, and includes an RBAC-backed admin console for catalog management, user requests, reports, and taxonomy.

## Features

- **Public catalog** – browse, search, and filter books by genre, author, source, publication status, and rating.
- **Personal library** – add books, set statuses, track chapters read, rate, and review.
- **Chapter reader** – clean, themeable reader with TTS, pronunciation rules, and raw-source support.
- **Auto archive** – background jobs scrape and archive translated and raw chapters; supports manual HTML imports and retries.
- **Raw translation** – machine-translate raw chapters using OpenAI or Gemini.
- **Requests and reports** – users can submit book requests and reports; admins manage them from the console.
- **Notifications** – in-app notification queue for user activity.
- **RBAC admin console** – role-based access with users, roles, groups, resources, capabilities, and audit logs.
- **Data migration pipeline** – safe legacy import/export and verification (`npm run deploy`, `npm run import:data`).

## Tech stack

- **Backend**: Fastify 5 (Node.js/TypeScript), MongoDB + Mongoose, Redis/BullMQ (optional), Puppeteer + Cheerio, Zod, Casbin.
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS.
- **Testing**: Vitest (unit/integration), Playwright (e2e).
- **Infra**: Docker Compose, AWS Lightsail/EC2, Caddy/Nginx reverse proxy.

## Project structure

```
novels-library/
├── backend/       # Fastify API, models, services, worker, scripts, migrations
├── frontend/      # Next.js app
└── e2e/           # Playwright end-to-end tests
```

## Quick start

1. Start MongoDB (and Redis if `REDIS_ENABLED=true`).
2. Install dependencies:
   ```bash
   cd backend && npm install
   cd frontend && npm install
   cd e2e && npm install
   ```
3. Configure environment variables (see [Configuration](#configuration)).
4. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```
5. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Configuration

Environment files are not committed; create the relevant `.env` files from the values below.

### Backend (`backend/.env`)

```
PORT=5050
HOST=0.0.0.0
MONGODB_URI=mongodb://127.0.0.1:27017/novels-library
JWT_SECRET=...
ADMIN_EMAIL=admin@example.com
REDIS_ENABLED=false
REDIS_URL=redis://127.0.0.1:6379

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...

AI_TRANSLATION_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_TRANSLATION_MODEL=gemini-2.0-flash
DEFAULT_TRANSLATION_TARGET_LANGUAGE=English
```

You can also set `AI_TRANSLATION_PROVIDER=openai` and use `OPENAI_API_KEY` / `OPENAI_TRANSLATION_MODEL` instead. Additional optional variables (CORS origins, Google OAuth, scraper timeouts, cover storage, backup/restore targets, etc.) are loaded from `backend/src/config/index.ts`.

### E2E (`e2e/.env.test`)

```
API_HEALTH_URL=http://localhost:5050/health
API_BASE_URL=http://localhost:5050
FRONTEND_BASE_URL=http://localhost:3000
TEST_USER_EMAIL=admin@example.com
TEST_USER_PASSWORD=admin123
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:5050/api
```

## Deployment and data migration

1. Provision an AWS Lightsail/EC2 instance and open ports `22`, `80`, `443`.
2. Install Docker and Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-plugin git
   sudo usermod -aG docker $USER
   ```
3. Clone the repo to `/opt/novels-library` and checkout the desired `ver_*` branch.
4. Create `backend/.env` with the required variables.
5. Build and run the backend:
   ```bash
   cd /opt/novels-library/backend
   docker compose up -d --build
   ```
6. Configure Caddy/Nginx to proxy `https://api.yourdomain.com` to `127.0.0.1:5050`.

The backend container (`novels-library-app`) runs `node dist/app.js`, which starts the API and the background worker.

To migrate or rebuild the environment, run the safe deployment pipeline:

```bash
cd /opt/novels-library/backend
npm run deploy
```

`npm run deploy` connects to `MONGODB_URI`, creates pre- and post-migration backups, runs migrations, seeds RBAC constants, and verifies document counts. To import a legacy data export before running migrations, place JSON array files in `backend/data_export/` and run:

```bash
npm run import:data -- --drop
```

This drops the target legacy collections and imports each file with `mongoimport`, preserving original `_id`s.

## Testing

All tests use **Vitest** for unit/integration work and **Playwright** for end-to-end browser tests.

### Backend tests

```bash
cd backend
npm run test              # run unit/integration tests once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

The backend test suite uses `mongodb-memory-server` so a real MongoDB instance is not required.

### Frontend tests

```bash
cd frontend
npm run test              # run component tests once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

Frontend component tests run in `jsdom` and use React Testing Library.

### E2E tests

```bash
cd e2e
npm install
npm run install:playwright
npm run test
```

Playwright will start the backend (`npm run dev` in `backend`) and frontend (`npm run dev` in `frontend`) automatically. Configure the target URLs in `e2e/.env.test`.

## GitHub Actions

- `CI` runs lint, typecheck, tests, build, and security scans on `ver_*` branches.
- `Deploy to AWS` is a manual `workflow_dispatch` that deploys the selected branch.

Set these repository secrets for the deploy workflow:

- `AWS_HOST`
- `AWS_USER`
- `SSH_PRIVATE_KEY`
- (Optional) `ENV_FILE`
