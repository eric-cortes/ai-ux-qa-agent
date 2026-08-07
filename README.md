# AI UX QA Agent

Initial local scaffold for Product A.

## Apps

- `apps/web` — Next.js dashboard shell
- `apps/api` — FastAPI API shell
- `workers/browser` — Playwright evidence collector
- `workers/ai` — OpenAI analysis placeholder
- `packages/shared-types` — shared Zod schemas
- `infrastructure/docker` — local PostgreSQL and Redis

## Start local dependencies

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## Start web

```bash
pnpm install
pnpm dev:web
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` in your local `.env`.

## Start API

```bash
cd apps/api
uvicorn app.main:app --reload --port 8000
```

## Run browser worker

```bash
pnpm --filter @ai-ux-qa/browser-worker dev
```
