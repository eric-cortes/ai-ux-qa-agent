import json

from app.services.artifacts import get_run_dir


def test_findings_missing_returns_empty(client):
    response = client.get("/api/runs/no_such_run/findings")
    assert response.status_code == 200
    assert response.json() == []


def test_findings_roundtrip(client):
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
        try:
            run_dir.rmdir()
        except OSError:
            pass
