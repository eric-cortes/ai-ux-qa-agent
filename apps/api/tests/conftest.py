import app.services.runs as runs_module
import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_runs():
    # Runs are stored in a module-level list; isolate every test.
    runs_module._RUNS.clear()
    yield
    runs_module._RUNS.clear()
