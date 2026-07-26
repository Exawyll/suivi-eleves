from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_still_works_alongside_static_serving() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_unknown_path_returns_404_when_frontend_not_built(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path / "does-not-exist")

    response = client.get("/classes/xyz")

    assert response.status_code == 404


def test_unknown_path_falls_back_to_index_html_when_frontend_is_built(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "index.html").write_text("<html><body>Carnet</body></html>")
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    response = client.get("/classes/xyz")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Carnet" in response.text


def test_existing_static_file_is_served_directly(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "index.html").write_text("<html><body>index</body></html>")
    (tmp_path / "manifest.webmanifest").write_text('{"name": "Carnet"}')
    monkeypatch.setattr(main, "STATIC_DIR", tmp_path)

    response = client.get("/manifest.webmanifest")

    assert response.status_code == 200
    assert "Carnet" in response.text


def test_path_traversal_outside_static_dir_falls_back_to_index_html(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html><body>Carnet</body></html>")
    secret = tmp_path / "secret.txt"
    secret.write_text("do not serve me")
    monkeypatch.setattr(main, "STATIC_DIR", static_dir)

    response = client.get("/../secret.txt")

    assert response.status_code == 200
    assert "do not serve me" not in response.text
