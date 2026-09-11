from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock, Thread
from uuid import uuid4

from app.core.paths import ARTIFACT_ROOT, PROJECT_ROOT
from app.schemas.run import CreateRunRequest, RunResponse


@dataclass
class RunRecord:
    id: str
    project_id: str
    environment_id: str | None
    target_url: str
    login_email: str | None
    login_password: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    artifact_dir: str | None = None
    error_message: str | None = None


_RUNS: list[RunRecord] = []
_LOCK = Lock()
_BROWSER_WORKER_TIMEOUT_SECONDS = int(os.getenv("BROWSER_WORKER_TIMEOUT_SECONDS", "180"))
_AI_WORKER_TIMEOUT_SECONDS = int(os.getenv("AI_WORKER_TIMEOUT_SECONDS", "120"))


def _to_response(run: RunRecord) -> RunResponse:
    return RunResponse(
        id=run.id,
        project_id=run.project_id,
        environment_id=run.environment_id,
        target_url=run.target_url,
        status=run.status,
        created_at=run.created_at,
        updated_at=run.updated_at,
        artifact_dir=run.artifact_dir,
        error_message=run.error_message,
    )


def list_runs() -> list[RunResponse]:
    with _LOCK:
        return [_to_response(run) for run in reversed(_RUNS)]


def get_run(run_id: str) -> RunResponse | None:
    with _LOCK:
        for run in _RUNS:
            if run.id == run_id:
                return _to_response(run)
    return None


def create_run(payload: CreateRunRequest) -> RunResponse:
    now = datetime.now(UTC)
    run = RunRecord(
        id=f"run_{uuid4().hex[:10]}",
        project_id=payload.project_id,
        environment_id=payload.environment_id,
        target_url=str(payload.target_url),
        login_email=payload.login_email,
        login_password=payload.login_password,
        status="queued",
        created_at=now,
        updated_at=now,
    )
    with _LOCK:
        _RUNS.append(run)

    Thread(target=_execute_run, args=(run.id,), daemon=True).start()
    return _to_response(run)


def _execute_run(run_id: str) -> None:
    with _LOCK:
        run = next((item for item in _RUNS if item.id == run_id), None)
        if run is None:
            return
        run.status = "running"
        run.updated_at = datetime.now(UTC)

    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.update(
        {
            "RUN_ID": run_id,
            "TARGET_URL": run.target_url,
            "ARTIFACT_LOCAL_DIR": str(ARTIFACT_ROOT),
        }
    )

    if run.login_email:
        env["TARGET_APP_LOGIN_EMAIL"] = run.login_email
    if run.login_password:
        env["TARGET_APP_LOGIN_PASSWORD"] = run.login_password

    with _LOCK:
        run.login_password = None

    try:
        completed = subprocess.run(
            ["pnpm", "--filter", "@ai-ux-qa/browser-worker", "dev"],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=_BROWSER_WORKER_TIMEOUT_SECONDS,
        )

        with _LOCK:
            run.updated_at = datetime.now(UTC)
            run.artifact_dir = str(ARTIFACT_ROOT / run_id)
            if completed.returncode == 0:
                run.status = "analyzing"
                run.error_message = None
            else:
                run.status = "failed"
                run.error_message = (completed.stderr or completed.stdout).strip()[-2000:] or "Browser worker failed"

        if completed.returncode != 0:
            return

        ai_completed = subprocess.run(
            [sys.executable, "workers/ai/app/main.py"],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=_AI_WORKER_TIMEOUT_SECONDS,
        )

        with _LOCK:
            run.updated_at = datetime.now(UTC)
            if ai_completed.returncode == 0:
                run.status = "completed"
                run.error_message = None
            else:
                run.status = "failed"
                run.error_message = (ai_completed.stderr or ai_completed.stdout).strip()[-2000:] or "AI worker failed"
    except subprocess.TimeoutExpired as exc:
        with _LOCK:
            run.status = "failed"
            run.updated_at = datetime.now(UTC)
            run.error_message = f"Run timed out after {exc.timeout} seconds"
    except Exception as exc:
        with _LOCK:
            run.status = "failed"
            run.updated_at = datetime.now(UTC)
            run.error_message = str(exc)
