from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[4]
ARTIFACT_ROOT = ROOT_DIR / "storage" / "artifacts"


def get_run_dir(run_id: str) -> Path:
    return ARTIFACT_ROOT / run_id


def read_json_artifact(run_id: str, filename: str) -> dict[str, Any] | list[Any] | None:
    path = get_run_dir(run_id) / filename
    if not path.exists():
        return None
    return json.loads(path.read_text())


def evidence_exists(run_id: str) -> bool:
    return (get_run_dir(run_id) / "evidence.json").exists()
