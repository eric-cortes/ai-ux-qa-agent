# Implementation Plan: CI Checks + Tests

**Audience:** a fresh Sonnet agent with no prior context. Everything needed is in
this file. Follow the phases in order. Verify each phase before moving on.

**Goal:** add a GitHub Actions CI pipeline and a baseline test suite to the
`ai-ux-qa-agent` monorepo, mirroring the structure of the sibling `/therapist`
repo (lint / typecheck / test / build gate + actionlint + gitleaks), adapted to
this repo's **Python (FastAPI + AI worker) + TypeScript (Next.js web, browser
worker, shared-types)** split.

Two of these tests are **regressions** for bugs already fixed and must not be
dropped:
- **Enum normalization** — the AI worker must coerce unknown finding
  `category`/`severity` to valid enums so `GET /runs/{id}/findings` can't 500.
- **SSRF guard** — the browser worker must block `localhost`, loopback,
  link-local metadata (`169.254.169.254`), and RFC-1918 targets before navigating.

---

## Repo facts (verified)

- Root: monorepo, `pnpm@10.0.0`, workspaces = `apps/*`, `workers/*`, `packages/*`.
- Node `v22.22.2`. Python `3.13` locally; packages declare `requires-python >=3.11`.
- `apps/api` — FastAPI. Has a `.venv`. Deps incl. `httpx` (so `fastapi.testclient`
  works). `dev-dependencies = []` currently. No pytest/ruff/mypy yet.
- `workers/ai` — standalone script `workers/ai/app/main.py`. Deps: `openai`
  (import is wrapped in try/except, so optional at runtime), `pydantic`.
  Exposes `normalize_category`, `normalize_severity`, `fallback_findings`, `Finding`.
- `workers/browser` — `tsx src/index.ts`. `tsconfig` uses
  `moduleResolution: "Bundler"` → **extensionless relative imports are OK**
  (`import { x } from "./ssrf"`). SSRF helpers currently live inline in `index.ts`
  and are **not exported** — Phase 3 extracts them.
- `packages/shared-types` — zod schemas. `moduleResolution: "Bundler"`.
- `apps/web` — Next 15.5. Scripts: `dev/build/start/lint`. **No eslint config file**
  (so `next lint` is fragile in CI — treated as optional below).
- No `.nvmrc`, no `.gitleaks.toml`, no ruff/mypy/pytest config anywhere.
- `storage/artifacts/.gitkeep` is tracked, so `ARTIFACT_ROOT` exists after checkout
  (important: `app.main` mounts `StaticFiles(directory=ARTIFACT_ROOT)` at import).

---

## Phase order (do sequentially, verify each)

1. Python test tooling + tests (`apps/api`, `workers/ai`)
2. SSRF refactor (extract `ssrf.ts`) — **must keep `index.ts` behavior identical**
3. TypeScript tests (vitest for `workers/browser` + `packages/shared-types`)
4. Root config files (`.nvmrc`, `.gitleaks.toml`, ruff config, root scripts)
5. CI workflow (`.github/workflows/ci.yml`)
6. Full local verification + regenerate lockfile

> **Lockfile gotcha (critical):** Phases 1–4 add devDependencies to several
> `package.json` files. CI runs `pnpm install --frozen-lockfile`, which **fails if
> `pnpm-lock.yaml` is stale**. After all package.json edits, run `pnpm install`
> once locally (Phase 6) to regenerate the lockfile and commit it.

---

## Phase 1 — Python tests

### 1a. `apps/api/pyproject.toml` — add dev deps + pytest config

Append to the file (keep existing `[project]` block):

```toml
[dependency-groups]
dev = ["pytest>=8.3.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

### 1b. `apps/api/tests/__init__.py`
Empty file.

### 1c. `apps/api/tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient

import app.services.runs as runs_module
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_runs():
    # Runs are stored in a module-level list; isolate every test.
    runs_module._RUNS.clear()
    yield
    runs_module._RUNS.clear()
```

### 1d. `apps/api/tests/test_health.py`

```python
def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

### 1e. `apps/api/tests/test_runs_api.py`

```python
import app.services.runs as runs_module


class _DummyThread:
    """Prevents create_run from spawning the real browser/AI subprocess."""

    def __init__(self, *args, **kwargs):
        pass

    def start(self):
        pass


def test_create_and_list_run(client, monkeypatch):
    monkeypatch.setattr(runs_module, "Thread", _DummyThread)

    created = client.post(
        "/api/runs",
        json={"project_id": "p1", "target_url": "https://example.com"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["id"].startswith("run_")
    assert body["status"] == "queued"
    assert body["target_url"].startswith("https://example.com")

    listed = client.get("/api/runs")
    assert listed.status_code == 200
    ids = [run["id"] for run in listed.json()]
    assert body["id"] in ids


def test_get_missing_run_returns_404(client):
    response = client.get("/api/runs/does_not_exist")
    assert response.status_code == 404


def test_create_run_rejects_bad_url(client, monkeypatch):
    monkeypatch.setattr(runs_module, "Thread", _DummyThread)
    response = client.post(
        "/api/runs",
        json={"project_id": "p1", "target_url": "not-a-url"},
    )
    assert response.status_code == 422
```

### 1f. `apps/api/tests/test_findings_endpoint.py`

Regression: a well-formed findings file returns findings; a missing one returns `[]`.

```python
import json

from app.services.artifacts import get_run_dir


def test_findings_missing_returns_empty(client):
    response = client.get("/api/runs/no_such_run/findings")
    assert response.status_code == 200
    assert response.json() == []


def test_findings_roundtrip(client, tmp_path_factory):
    run_id = "run_findingstest"
    run_dir = get_run_dir(run_id)
    run_dir.mkdir(parents=True, exist_ok=True)
    finding = {
        "id": "finding_1",
        "run_id": run_id,
        "category": "accessibility",
        "title": "Missing label",
        "description": "d",
        "severity": "high",
        "confidence": 0.9,
        "page_url": "https://example.com/",
        "observed_behavior": "o",
        "reproduction_steps": ["step"],
        "evidence_ids": ["evidence.json"],
        "status": "open",
    }
    try:
        (run_dir / "findings.json").write_text(json.dumps({"findings": [finding]}))
        response = client.get(f"/api/runs/{run_id}/findings")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["category"] == "accessibility"
        assert data[0]["severity"] == "high"
    finally:
        (run_dir / "findings.json").unlink(missing_ok=True)
        run_dir.rmdir()
```

### 1g. `workers/ai/pyproject.toml` — add pytest config

Append:

```toml
[dependency-groups]
dev = ["pytest>=8.3.0"]

[tool.pytest.ini_options]
pythonpath = ["app"]
testpaths = ["tests"]
```

### 1h. `workers/ai/tests/test_normalize.py`

```python
import main


def test_normalize_category_unknown_falls_back_to_ux():
    assert main.normalize_category("visual") == "ux"
    assert main.normalize_category("") == "ux"
    assert main.normalize_category(None) == "ux"


def test_normalize_category_valid_passthrough():
    assert main.normalize_category("Accessibility") == "accessibility"
    assert main.normalize_category("network") == "network"


def test_normalize_severity_unknown_falls_back_to_medium():
    assert main.normalize_severity("urgent") == "medium"
    assert main.normalize_severity(None) == "medium"


def test_normalize_severity_valid_passthrough():
    assert main.normalize_severity("Critical") == "critical"
    assert main.normalize_severity("low") == "low"
```

### 1i. `workers/ai/tests/test_fallback.py`

```python
import main


def test_fallback_empty_evidence_yields_nothing():
    assert main.fallback_findings("run_1", {}) == []


def test_fallback_flags_network_and_axe_and_console():
    evidence = {
        "finalUrl": "https://example.com/",
        "failedRequests": ["GET https://x/api :: net::ERR"],
        "errorResponses": [{"url": "https://x/api", "status": 500, "method": "GET"}],
        "axeViolations": [{"id": "color-contrast", "help": "Fix contrast"}],
        "consoleMessages": ["[error] boom"],
    }
    categories = {f.category for f in main.fallback_findings("run_1", evidence)}
    assert {"network", "functional", "accessibility"} <= categories
```

### Phase 1 verification

```bash
cd apps/api && python3 -m pip install -e . && python3 -m pip install pytest && python3 -m pytest
cd ../../workers/ai && python3 -m pip install pydantic pytest && python3 -m pytest
```
(Locally the `apps/api/.venv` already has fastapi/pydantic; you can instead use
`apps/api/.venv/bin/python -m pytest` from `apps/api`.)

Expect: all Python tests pass.

---

## Phase 2 — SSRF refactor (behavior-preserving)

Extract the SSRF helpers out of `workers/browser/src/index.ts` into a new
exported module so they can be unit-tested. **Do not change any logic** — the
live `assertSafeTarget` path in `index.ts` must behave exactly as today (verified
earlier against localhost / 127.0.0.1 / 169.254.169.254 / 192.168.x / file:).

### 2a. New file `workers/browser/src/ssrf.ts`

```ts
import dns from "node:dns/promises";
import net from "node:net";

export function parseAllowedDomains(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesAllowedDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isBlockedHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

export function isBlockedAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b, c, d] = address.split(".").map(Number);
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254 && c === 169 && d === 254)
    );
  }

  if (net.isIPv6(address)) {
    return address === "::1";
  }

  return false;
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  if (net.isIP(hostname)) {
    return [hostname];
  }

  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve target hostname: ${hostname}`);
  }

  return results.map((result) => result.address);
}

export async function assertSafeTarget(
  targetUrl: string,
  allowedDomains: string[],
): Promise<void> {
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported target URL protocol: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked target hostname: ${hostname}`);
  }

  if (
    allowedDomains.length > 0 &&
    !allowedDomains.some((domain) => matchesAllowedDomain(hostname, domain))
  ) {
    throw new Error(`Target hostname is not in TARGET_URL_ALLOWED_DOMAINS: ${hostname}`);
  }

  const addresses = await resolveHostname(hostname);
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new Error(`Blocked target address resolved for ${hostname}: ${address}`);
    }
  }
}
```

### 2b. Edit `workers/browser/src/index.ts`

- Remove the now-duplicated function definitions: `assertSafeTarget`,
  `parseAllowedDomains`, `matchesAllowedDomain`, `resolveHostname`,
  `isBlockedHostname`, `isBlockedAddress`.
- Add near the top imports:
  ```ts
  import { assertSafeTarget, parseAllowedDomains } from "./ssrf";
  ```
  (Remove the now-unused `dns`/`net` imports from `index.ts` if nothing else uses
  them — `tsc` strict will flag unused imports only if `noUnusedLocals` is set; it
  is not, but remove them for cleanliness.)
- Everything else in `index.ts` stays. `executeRun` still calls
  `await assertSafeTarget(targetUrl, allowedDomains);` and `main` still calls
  `parseAllowedDomains(process.env.TARGET_URL_ALLOWED_DOMAINS)`.

### Phase 2 verification

```bash
cd /Users/work/Repositories/personal/ai-ux-qa-agent
./node_modules/.bin/tsc -p workers/browser/tsconfig.json --noEmit   # must pass
# Behavior smoke (must still block):
cd workers/browser
RUN_ID=t TARGET_URL="http://169.254.169.254/" ARTIFACT_LOCAL_DIR=/tmp/s ./node_modules/.bin/tsx src/index.ts 2>&1 | grep -i blocked
```

---

## Phase 3 — TypeScript tests (vitest)

### 3a. `workers/browser/package.json`
Add `"test": "vitest run"` to `scripts`, and `"vitest": "^2.1.0"` to
`devDependencies`.

### 3b. `workers/browser/vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

### 3c. `workers/browser/src/ssrf.test.ts`
```ts
import { describe, expect, it } from "vitest";

import {
  assertSafeTarget,
  isBlockedAddress,
  isBlockedHostname,
  matchesAllowedDomain,
  parseAllowedDomains,
} from "./ssrf";

describe("isBlockedAddress", () => {
  it("blocks loopback, private, and metadata addresses", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.0.0.5")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // example.com
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });
});

describe("isBlockedHostname / matchesAllowedDomain / parseAllowedDomains", () => {
  it("blocks localhost variants", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("app.localhost")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });

  it("matches allowlist by exact host and subdomain", () => {
    expect(matchesAllowedDomain("example.com", "example.com")).toBe(true);
    expect(matchesAllowedDomain("staging.example.com", "example.com")).toBe(true);
    expect(matchesAllowedDomain("evil.com", "example.com")).toBe(false);
  });

  it("parses a comma list", () => {
    expect(parseAllowedDomains(" A.com , b.com ")).toEqual(["a.com", "b.com"]);
    expect(parseAllowedDomains(undefined)).toEqual([]);
  });
});

describe("assertSafeTarget (IP literals only — no DNS)", () => {
  it("rejects blocked targets", async () => {
    await expect(assertSafeTarget("http://127.0.0.1/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://localhost/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://169.254.169.254/", [])).rejects.toThrow();
    await expect(assertSafeTarget("http://192.168.1.1/", [])).rejects.toThrow();
    await expect(assertSafeTarget("file:///etc/passwd", [])).rejects.toThrow();
  });

  it("allows a public IP literal", async () => {
    await expect(assertSafeTarget("http://93.184.216.34/", [])).resolves.toBeUndefined();
  });

  it("enforces the allowlist against a public IP literal", async () => {
    // Allowlist is matched on hostname; an IP not in the list is rejected.
    await expect(assertSafeTarget("http://93.184.216.34/", ["example.com"])).rejects.toThrow();
  });
});
```
> Note: all `assertSafeTarget` cases use IP literals or `localhost`, so
> `resolveHostname` short-circuits via `net.isIP` and **no real DNS is performed**
> — the tests are deterministic and offline.

### 3d. `packages/shared-types/package.json`
Add `"test": "vitest run"` to `scripts`, `"vitest": "^2.1.0"` to `devDependencies`.

### 3e. `packages/shared-types/vitest.config.ts`
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

### 3f. `packages/shared-types/src/schemas.test.ts`
```ts
import { describe, expect, it } from "vitest";

import { createRunSchema } from "./index";

describe("createRunSchema", () => {
  it("accepts a valid payload", () => {
    const parsed = createRunSchema.parse({
      projectId: "p1",
      targetUrl: "https://example.com",
    });
    expect(parsed.projectId).toBe("p1");
  });

  it("rejects a bad url", () => {
    expect(() => createRunSchema.parse({ projectId: "p1", targetUrl: "nope" })).toThrow();
  });

  it("rejects an empty projectId", () => {
    expect(() => createRunSchema.parse({ projectId: "", targetUrl: "https://x.com" })).toThrow();
  });
});
```

### Phase 3 verification
```bash
pnpm install                 # picks up new vitest devDeps + updates lockfile
pnpm -r --if-present test     # runs both vitest suites
```

---

## Phase 4 — Root config + scripts

### 4a. `.nvmrc`
```
22
```

### 4b. `.gitleaks.toml`
```toml
# Use gitleaks' bundled default rules; add allowlist entries here if needed.
[extend]
useDefault = true
```

### 4c. Ruff config — append to **root** create `ruff.toml`
```toml
target-version = "py311"
line-length = 120

[lint]
select = ["E", "F", "I", "UP", "B"]

[lint.per-file-ignores]
"**/tests/*" = ["E501"]
```

### 4d. Root `package.json` — add convenience scripts
Add to `scripts`:
```json
"test": "pnpm -r --if-present test",
"typecheck": "tsc -p apps/web/tsconfig.json --noEmit && tsc -p workers/browser/tsconfig.json --noEmit && tsc -p packages/shared-types/tsconfig.json --noEmit"
```
(Keep existing `dev`, `dev:web`, etc.)

---

## Phase 5 — CI workflow

### `.github/workflows/ci.yml`
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  python:
    name: Python lint + tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install tooling
        run: python -m pip install --upgrade pip ruff pytest

      - name: Install packages
        run: |
          python -m pip install -e apps/api
          python -m pip install pydantic openai

      - name: Ruff lint
        run: ruff check apps workers

      - name: Ruff format check
        run: ruff format --check apps workers

      - name: Pytest (api)
        working-directory: apps/api
        run: python -m pytest

      - name: Pytest (ai worker)
        working-directory: workers/ai
        run: python -m pytest

  node:
    name: Node typecheck + tests + build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.0.0
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm -r --if-present test

      - name: Build web
        run: pnpm build:web

  actionlint:
    name: Lint workflows
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download actionlint
        run: bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
      - name: Run actionlint
        run: ./actionlint -color

  secret-scan:
    name: Secret scanning (gitleaks)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run gitleaks
        run: docker run --rm -v "${{ github.workspace }}:/repo" zricethezav/gitleaks:latest detect --source /repo --config /repo/.gitleaks.toml --verbose --redact
```

**Notes / deliberate omissions vs. therapist:**
- No `docker-build` job — this repo has no app Dockerfiles yet (only a
  `docker-compose` for Postgres/Redis). Add when P1 introduces Dockerfiles.
- No Postgres/Redis service containers — runs are in-memory today; add with P1
  persistence.
- No `next lint` step — `apps/web` has no eslint config; `next lint` would prompt/
  fail. Optional follow-up: add `eslint` + `eslint-config-next` +
  `apps/web/eslint.config.mjs`, then a lint step. `tsc --noEmit` already covers
  type errors.
- `mypy` intentionally omitted (noisy on an untyped-ish codebase); can be added
  later as a non-blocking job.

---

## Phase 6 — Final verification (run all, must be green)

```bash
cd /Users/work/Repositories/personal/ai-ux-qa-agent

# 1. Regenerate lockfile after all package.json edits (fixes --frozen-lockfile in CI)
pnpm install

# 2. Node side
pnpm typecheck
pnpm -r --if-present test
pnpm build:web

# 3. Python side (use the api venv or a fresh install)
apps/api/.venv/bin/python -m pip install pytest ruff
( cd apps/api && ../../apps/api/.venv/bin/python -m pytest )
( cd workers/ai && python3 -m pip install pydantic pytest && python3 -m pytest )
ruff check apps workers
ruff format --check apps workers

# 4. Optional: lint the workflow if actionlint is installed locally
#    (CI does this anyway)
```

## Acceptance criteria
- [ ] `pnpm -r --if-present test` passes (browser SSRF + shared-types vitest suites).
- [ ] `apps/api` pytest: health, runs CRUD/404/422, findings round-trip + empty — all pass.
- [ ] `workers/ai` pytest: normalize + fallback — all pass.
- [ ] `pnpm typecheck` passes (SSRF refactor compiles).
- [ ] `pnpm build:web` succeeds.
- [ ] `ruff check` / `ruff format --check` clean.
- [ ] SSRF smoke: `TARGET_URL=http://169.254.169.254/` still prints a "Blocked" error.
- [ ] `pnpm-lock.yaml` regenerated and committed (no `--frozen-lockfile` drift).
- [ ] `.github/workflows/ci.yml` present with jobs: python, node, actionlint, secret-scan.

## Do NOT
- Do not weaken or change SSRF logic during the Phase 2 extraction — copy verbatim.
- Do not add real network calls to tests (SSRF tests use IP literals only).
- Do not add `Co-Authored-By` / Claude attribution to any commit.
- Do not commit or push unless explicitly asked.
```
