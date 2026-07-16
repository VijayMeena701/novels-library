# novels-library

Personal web-novel catalog and reader.

## Branches

- Use `ver_*` branches for releases, e.g. `ver_0.0.1`, `ver_1.0.0`.
- Open a pull request against a `ver_*` branch to run the `CI` workflow.
- Merging does **not** deploy. Run the `Deploy to AWS` workflow manually from the branch you want to release.

## Backend deployment (AWS + Docker)

1. Provision an AWS Lightsail/EC2 instance and open ports `22`, `80`, `443`.
2. Install Docker and Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-plugin git
   sudo usermod -aG docker $USER
   ```
3. Clone the repo to `/opt/novels-library` and checkout the desired `ver_*` branch.
4. Create `backend/.env` with the required variables (MongoDB Atlas URI, JWT secret, CORS origins, etc.).
5. Deploy:
   ```bash
   cd /opt/novels-library/backend
   docker compose up -d --build
   ```
6. Configure Caddy/Nginx to proxy `https://api.yourdomain.com` to `127.0.0.1:5050`.

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
