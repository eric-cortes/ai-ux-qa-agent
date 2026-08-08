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
