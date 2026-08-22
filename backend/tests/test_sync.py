import base64
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.throttle import login_throttle
from app.repositories.sync_repository import SyncRepository
from app.schemas.sync import MAX_CIPHERTEXT_BYTES, MAX_RECORDS_PER_PUSH, PushRecord
from main import app

client = TestClient(app)

NONCE = base64.b64encode(b"n" * 12).decode()
NOW = datetime(2026, 3, 18, 9, 30, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _clear_throttle() -> Iterator[None]:
    login_throttle.clear()
    yield
    login_throttle.clear()


def cipher(text: str) -> str:
    """Stands in for a real envelope: the server never looks inside one."""
    return base64.b64encode(text.encode()).decode()


def account(email: str) -> dict[str, str]:
    """Creates an account and returns its Authorization header."""
    secret = base64.b64encode(email.encode().ljust(32, b"x")[:32]).decode()
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "firstName": "Prof",
            "lastName": "Test",
            "authSecret": secret,
            "kdfSalt": base64.b64encode(b"s" * 16).decode(),
            "kdfIterations": 600_000,
            "wrappedDek": base64.b64encode(b"w" * 48).decode(),
            "dekNonce": NONCE,
        },
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def record(
    entity_id: str,
    *,
    entity_type: str = "eleve",
    text: str = "Camille",
    updated_at: datetime = NOW,
    base_revision: int | None = None,
    deleted: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "entityType": entity_type,
        "entityId": entity_id,
        "baseRevision": base_revision,
        "clientUpdatedAt": updated_at.isoformat(),
        "deleted": deleted,
    }
    if not deleted:
        payload["ciphertext"] = cipher(text)
        payload["nonce"] = NONCE
    return payload


def push(headers: dict[str, str], *records: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/api/v1/sync/changes", headers=headers, json={"records": list(records)})
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def pull(headers: dict[str, str], since: int = 0, limit: int | None = None) -> dict[str, Any]:
    params: dict[str, int] = {"since": since}
    if limit is not None:
        params["limit"] = limit
    response = client.get("/api/v1/sync/changes", headers=headers, params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


@pytest.mark.usefixtures("clean_database")
def test_a_new_account_has_nothing_to_pull() -> None:
    headers = account("vide@example.org")

    body = pull(headers)

    assert body == {"records": [], "nextCursor": 0, "hasMore": False}


@pytest.mark.usefixtures("clean_database")
def test_pushed_envelopes_come_back_byte_for_byte() -> None:
    headers = account("aller-retour@example.org")

    pushed = push(headers, record("eleve-1", text="Camille"), record("eleve-2", text="Dominique"))

    assert len(pushed["applied"]) == 2
    assert pushed["conflicts"] == []

    records = pull(headers)["records"]
    assert [r["entityId"] for r in records] == ["eleve-1", "eleve-2"]
    assert records[0]["ciphertext"] == cipher("Camille")
    assert records[0]["nonce"] == NONCE
    # Revisions order the stream; they are assigned by the server, never sent.
    assert records[0]["revision"] < records[1]["revision"]


@pytest.mark.usefixtures("clean_database")
def test_pulling_from_a_cursor_returns_only_what_came_after() -> None:
    headers = account("curseur@example.org")
    push(headers, record("eleve-1"))
    first = pull(headers)

    push(headers, record("eleve-2", text="Dominique"))
    second = pull(headers, since=first["nextCursor"])

    assert [r["entityId"] for r in second["records"]] == ["eleve-2"]
    assert second["nextCursor"] > first["nextCursor"]


@pytest.mark.usefixtures("clean_database")
def test_an_empty_pull_leaves_the_cursor_where_it_was() -> None:
    """Advancing past a revision the client never saw would lose it for good."""
    headers = account("curseur-vide@example.org")
    push(headers, record("eleve-1"))
    cursor = pull(headers)["nextCursor"]

    assert pull(headers, since=cursor)["nextCursor"] == cursor


@pytest.mark.usefixtures("clean_database")
def test_pagination_reports_more_and_resumes_exactly() -> None:
    headers = account("pagination@example.org")
    push(headers, *(record(f"eleve-{i}") for i in range(5)))

    first = pull(headers, limit=2)
    assert first["hasMore"] is True
    assert len(first["records"]) == 2

    second = pull(headers, since=first["nextCursor"], limit=2)
    third = pull(headers, since=second["nextCursor"], limit=2)

    assert third["hasMore"] is False
    seen = [r["entityId"] for page in (first, second, third) for r in page["records"]]
    assert seen == [f"eleve-{i}" for i in range(5)]


@pytest.mark.usefixtures("clean_database")
def test_an_up_to_date_device_may_overwrite() -> None:
    headers = account("maj@example.org")
    revision = push(headers, record("eleve-1", text="Camille"))["applied"][0]["revision"]

    updated = push(
        headers, record("eleve-1", text="Camille R.", base_revision=revision, updated_at=NOW)
    )

    assert updated["conflicts"] == []
    assert pull(headers)["records"][0]["ciphertext"] == cipher("Camille R.")


@pytest.mark.usefixtures("clean_database")
def test_a_stale_device_with_an_older_edit_loses_and_is_told_so() -> None:
    headers = account("conflit-perdu@example.org")
    revision = push(headers, record("eleve-1", text="version serveur", updated_at=NOW))["applied"][
        0
    ]["revision"]

    late = push(
        headers,
        record(
            "eleve-1",
            text="version périmée",
            updated_at=NOW - timedelta(hours=1),
            # Derived, not hard-coded: a literal that happened to match the real
            # revision would take the "device is up to date" branch and the test
            # would pass while proving nothing about conflicts.
            base_revision=revision - 1,
        ),
    )

    assert late["applied"] == []
    assert len(late["conflicts"]) == 1
    # The client is handed what actually stands, so it can apply it locally.
    assert late["conflicts"][0]["ciphertext"] == cipher("version serveur")
    assert pull(headers)["records"][0]["ciphertext"] == cipher("version serveur")


@pytest.mark.usefixtures("clean_database")
def test_a_stale_device_with_a_newer_edit_wins() -> None:
    """Last write wins: being out of date is not the same as being wrong."""
    headers = account("conflit-gagne@example.org")
    revision = push(headers, record("eleve-1", text="ancienne", updated_at=NOW))["applied"][0][
        "revision"
    ]

    later = push(
        headers,
        record(
            "eleve-1",
            text="plus récente",
            updated_at=NOW + timedelta(hours=1),
            base_revision=revision - 1,
        ),
    )

    assert later["conflicts"] == []
    assert pull(headers)["records"][0]["ciphertext"] == cipher("plus récente")


@pytest.mark.usefixtures("clean_database")
def test_a_deletion_travels_as_a_tombstone_not_a_disappearance() -> None:
    """A row that simply vanished would be resurrected by any offline device."""
    headers = account("tombstone@example.org")
    revision = push(headers, record("eleve-1"))["applied"][0]["revision"]

    push(
        headers,
        record(
            "eleve-1", deleted=True, base_revision=revision, updated_at=NOW + timedelta(hours=1)
        ),
    )

    records = pull(headers)["records"]
    assert len(records) == 1
    assert records[0]["deleted"] is True
    assert records[0]["ciphertext"] is None
    assert records[0]["nonce"] is None


@pytest.mark.usefixtures("clean_database")
def test_two_accounts_never_see_each_other() -> None:
    """The point of the whole feature, asserted from both directions."""
    camille = account("camille@example.org")
    dominique = account("dominique@example.org")

    push(camille, record("eleve-1", text="élève de Camille"))
    push(dominique, record("eleve-9", text="élève de Dominique"))

    camille_records = pull(camille)["records"]
    dominique_records = pull(dominique)["records"]

    assert [r["entityId"] for r in camille_records] == ["eleve-1"]
    assert [r["entityId"] for r in dominique_records] == ["eleve-9"]
    assert pull(camille)["records"][0]["ciphertext"] == cipher("élève de Camille")

    assert client.get("/api/v1/sync/status", headers=camille).json()["recordCount"] == 1
    assert client.get("/api/v1/sync/status", headers=dominique).json()["recordCount"] == 1


@pytest.mark.usefixtures("clean_database")
def test_pushing_a_shared_entity_id_does_not_touch_the_other_account() -> None:
    """The primary key includes the account, so the same id is two records."""
    camille = account("camille2@example.org")
    dominique = account("dominique2@example.org")
    push(camille, record("eleve-1", text="chez Camille", updated_at=NOW))

    # Dominique pushes the *same* entity id, later, with no base revision — the
    # shape of a hostile overwrite if the account were not part of the key.
    push(dominique, record("eleve-1", text="chez Dominique", updated_at=NOW + timedelta(days=1)))

    assert pull(camille)["records"][0]["ciphertext"] == cipher("chez Camille")
    assert pull(dominique)["records"][0]["ciphertext"] == cipher("chez Dominique")


@pytest.mark.usefixtures("clean_database")
def test_deleting_an_account_takes_its_records_with_it() -> None:
    headers = account("effacement@example.org")
    push(headers, record("eleve-1"))

    assert client.delete("/api/v1/account", headers=headers).status_code == 204

    assert client.get("/api/v1/sync/changes", headers=headers).status_code == 401


@pytest.mark.usefixtures("clean_database")
def test_every_sync_route_requires_a_token() -> None:
    assert client.get("/api/v1/sync/changes").status_code == 401
    assert client.get("/api/v1/sync/status").status_code == 401
    assert client.post("/api/v1/sync/changes", json={"records": []}).status_code == 401


@pytest.mark.usefixtures("clean_database")
def test_a_record_is_either_an_envelope_or_a_tombstone() -> None:
    headers = account("coherence@example.org")

    live_without_contents = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={
            "records": [
                {
                    "entityType": "eleve",
                    "entityId": "eleve-1",
                    "clientUpdatedAt": NOW.isoformat(),
                    "deleted": False,
                }
            ]
        },
    )
    tombstone_with_contents = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={"records": [record("eleve-1", deleted=False) | {"deleted": True}]},
    )

    assert live_without_contents.status_code == 422
    assert tombstone_with_contents.status_code == 422


@pytest.mark.usefixtures("clean_database")
def test_oversized_and_overlong_pushes_are_refused_at_the_edge() -> None:
    headers = account("gardefou@example.org")

    too_big = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={
            "records": [
                record("eleve-1")
                | {"ciphertext": base64.b64encode(b"x" * (MAX_CIPHERTEXT_BYTES + 1)).decode()}
            ]
        },
    )
    too_many = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={"records": [record(f"eleve-{i}") for i in range(MAX_RECORDS_PER_PUSH + 1)]},
    )
    unknown_type = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={"records": [record("x-1", entity_type="secret-du-serveur")]},
    )

    assert too_big.status_code == 422
    assert too_many.status_code == 422
    assert unknown_type.status_code == 422


@pytest.mark.usefixtures("clean_database")
def test_a_naive_timestamp_is_refused() -> None:
    """Last-write-wins compares instants; a timestamp without a zone is not one."""
    headers = account("naif@example.org")

    response = client.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={"records": [record("eleve-1") | {"clientUpdatedAt": "2026-03-18T09:30:00"}]},
    )

    assert response.status_code == 422


@pytest.mark.usefixtures("clean_database")
def test_a_push_never_hands_back_a_pull_cursor() -> None:
    """The trap this omission exists to avoid, asserted rather than assumed.

    A device pushing while it is behind must not be told where the stream now
    ends: adopting that as its cursor would skip every record it never pulled.
    """
    behind = account("en-retard@example.org")
    push(behind, record("eleve-1"))
    cursor = pull(behind)["nextCursor"]

    # Something else lands — another device of the same account, in practice.
    push(behind, record("eleve-2", text="saisie de l'autre appareil"))
    later = push(behind, record("eleve-3", text="saisie de cet appareil-ci"))

    assert "cursor" not in later
    # The only cursor that moves is the one a pull returns, and it still leads
    # back to everything this device has not seen.
    caught_up = pull(behind, since=cursor)
    assert [r["entityId"] for r in caught_up["records"]] == ["eleve-2", "eleve-3"]


@pytest.mark.usefixtures("clean_database")
def test_a_push_that_fails_halfway_applies_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    """A batch is one transaction, so a failure cannot leave half of it stored.

    Nothing in the service opens a transaction explicitly — the request-scoped
    session does, committing once at the end and rolling back on any exception.
    That is easy to assert by reading and easy to break by accident, so it is
    asserted by breaking it: the third upsert of a five-record batch raises.
    """
    headers = account("atomique@example.org")
    real_upsert = SyncRepository.upsert
    calls = {"n": 0}

    async def fails_on_the_third(self: SyncRepository, record: PushRecord) -> int | None:
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("la base a lâché en plein lot")
        return await real_upsert(self, record)

    monkeypatch.setattr(SyncRepository, "upsert", fails_on_the_third)
    tolerant = TestClient(app, raise_server_exceptions=False)

    response = tolerant.post(
        "/api/v1/sync/changes",
        headers=headers,
        json={"records": [record(f"eleve-{i}") for i in range(5)]},
    )

    assert response.status_code == 500
    monkeypatch.undo()
    assert pull(headers)["records"] == []


@pytest.mark.usefixtures("clean_database")
def test_status_reports_the_head_revision_and_the_count() -> None:
    headers = account("etat@example.org")
    applied = push(headers, record("eleve-1"), record("eleve-2"))["applied"]

    body = client.get("/api/v1/sync/status", headers=headers).json()

    assert body["recordCount"] == 2
    assert body["serverRevision"] == max(r["revision"] for r in applied)
