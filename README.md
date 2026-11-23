# AI UX QA Agent

A local QA dashboard for queueing browser runs, collecting screenshots and browser evidence,
reviewing AI findings, and deleting saved runs and artifacts.

## Parts

- `apps/web`: English Next.js dashboard, with a system light/dark theme and accessible Base UI controls.
- `apps/api`: FastAPI run API and local worker orchestration.
- `workers/browser`: Playwright evidence collector and accessibility checks.
- `workers/ai`: Python AI analysis, with guideline checks and optional OpenAI analysis.
- `packages/shared-types`: shared Zod schemas and TypeScript types.
- `infrastructure/docker`: local PostgreSQL 16 and Redis 7 services.

Runs live in the API’s in-memory `_RUNS` list in `apps/api/app/services/runs.py` and are
lost on API restart. Artifacts are files under `storage/artifacts`. PostgreSQL and Redis are
provisioned by `infrastructure/docker` but are not used by the current code.

## Environment and running

Use Node 26 and pnpm 12.23.0. The root `.env.example` documents the environment. Create your
local `.env` from it and supply local values; never commit secrets. The web API URL comes from
`NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:8000/api`. Next.js needs this variable
in its process environment (or `apps/web/.env.local`); a root `.env` alone is not loaded by Next.js.
The API, workers and artifact storage must be available for live dashboard use.

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
pnpm install
pnpm dev
```

`pnpm dev` starts the API and web together through `dev.sh`. To run them separately:

```bash
pnpm dev:web
cd apps/api
uvicorn app.main:app --reload --port 8000
```

The API orchestrates workers for queued runs. To invoke the browser worker separately, provide
its run environment and use `pnpm dev:browser-worker`. The AI worker entry is
`workers/ai/app/main.py`; its standalone invocation needs `RUN_ID` and `ARTIFACT_LOCAL_DIR`.
Configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` for model-backed analysis.

## JavaScript checks

```bash
pnpm validate
pnpm test
pnpm e2e
pnpm build
```

Validation runs ESLint, Prettier, TypeScript and the standard Tailwind checker. Vitest covers
utilities, components, API errors, polling and stale responses. Playwright mocks the API and
covers dashboard flows, keyboard focus and reduced motion. Install Chromium before E2E with
`pnpm --filter web exec playwright install --with-deps chromium`.

Lefthook formats staged files and fixes ESLint per package before commit, then checks Tailwind;
before push it runs validation. CI validates, tests and builds on `master` and `development`
pushes and pull requests; E2E runs on manual dispatch and pull requests targeting `master`.

## Python checks (unchanged)

```bash
ruff check apps workers
ruff format --check apps workers
(cd apps/api && python -m pytest -v)
(cd workers/ai && python -m pytest -v)
```

Run the two pytest commands from the repository root in separate shells. Python dependencies
and tooling remain separate from pnpm. See [the app overview](docs/app-overview.html) for the
stack, flows and folder map.
