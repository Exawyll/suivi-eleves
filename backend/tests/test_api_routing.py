from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
from main import app

client = TestClient(app)


def test_health_still_answers() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_routes_are_not_swallowed_by_the_spa_catch_all(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An unknown API path answers a JSON 404, even once a build is present.

    Simulating the built frontend matters: without it the catch-all 404s for its
    own reason, and the test would pass while production quietly served
    index.html with a 200 to an API client.
    """
    (tmp_path / "index.html").write_text("<!doctype html><title>Carnet</title>")
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    spa = client.get("/une/route/du/frontend")
    assert spa.status_code == 200
    assert spa.headers["content-type"].startswith("text/html")

    api = client.get("/api/v1/does-not-exist")
    assert api.status_code == 404
    assert api.headers["content-type"].startswith("application/json")
    assert api.json()["detail"] == "Not found"


def test_database_health_reports_rather_than_crashes() -> None:
    """Answers 200 whether or not Postgres is reachable.

    Written this way on purpose: it proves the router, the session dependency
    and the error path are wired, and it runs identically on a laptop with no
    database and in CI where one is running.
    """
    response = client.get("/api/v1/health/db")

    assert response.status_code == 200
    body = response.json()
    assert body["database"] in {"ok", "unavailable"}
    assert body["status"] == ("ok" if body["database"] == "ok" else "degraded")
