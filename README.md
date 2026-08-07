# AI UX QA Agent

The AI UX QA Agent is a web-based quality assurance platform that autonomously explores web applications, executes user flows, collects technical and visual evidence, analyzes UX and accessibility issues with AI, and produces structured findings.

The system is intended for development and QA teams testing staging, preview, and production environments.

Implementation scope:

- The initial implementation will be configured and validated against one designated web application and its environments.
- The architecture retains organizations, projects, roles, integrations, and provider abstractions for future expansion.
- Multi-project operation is supported by the design, but is not required for the initial release.
- Billing, subscriptions, payment processing, usage invoicing, and commercial account management are outside the scope of this project.

Primary capabilities:

- Execute automated browser sessions.
- Explore predefined and AI-generated user journeys.
- Capture screenshots, DOM snapshots, console output, network failures, and accessibility violations.
- Analyze findings with LLM-based agents.
- Deduplicate and validate potential issues.
- Assign severity and confidence scores.
- Generate structured bug reports.
- Generate Playwright regression tests.
- Integrate QA checks into CI/CD workflows.
- Publish results to GitHub pull requests.

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
