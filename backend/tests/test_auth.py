import base64
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.throttle import login_throttle
from main import app

client = TestClient(app)

AUTH_SECRET = base64.b64encode(b"a" * 32).decode()
OTHER_AUTH_SECRET = base64.b64encode(b"b" * 32).decode()
KDF_SALT = base64.b64encode(b"s" * 16).decode()
WRAPPED_DEK = base64.b64encode(b"w" * 48).decode()
DEK_NONCE = base64.b64encode(b"n" * 12).decode()

WRONG_CREDENTIALS = "Adresse ou mot de passe incorrect."


@pytest.fixture(autouse=True)
def _clear_throttle() -> Iterator[None]:
    """The throttle is process-wide, so failures would leak between tests."""
    login_throttle.clear()
    yield
    login_throttle.clear()


def signup_payload(email: str = "prof@example.org", **overrides: object) -> dict[str, object]:
    return {
        "email": email,
        "firstName": "Camille",
        "lastName": "Roux",
        "authSecret": AUTH_SECRET,
        "kdfSalt": KDF_SALT,
        "kdfIterations": 600_000,
        "wrappedDek": WRAPPED_DEK,
        "dekNonce": DEK_NONCE,
        **overrides,
    }


def signup(email: str = "prof@example.org", **overrides: object) -> dict[str, Any]:
    response = client.post("/api/v1/auth/signup", json=signup_payload(email, **overrides))
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


@pytest.mark.usefixtures("clean_database")
def test_signup_returns_a_session_and_the_crypto_material_back() -> None:
    body = signup()

    assert body["user"]["email"] == "prof@example.org"
    assert body["tokenType"] == "Bearer"
    assert body["accessToken"] and body["refreshToken"]
    # Handed straight back so a second device can unlock without a round-trip.
    assert body["crypto"] == {
        "kdfSalt": KDF_SALT,
        "kdfIterations": 600_000,
        "wrappedDek": WRAPPED_DEK,
        "dekNonce": DEK_NONCE,
    }


@pytest.mark.usefixtures("clean_database")
def test_the_email_is_normalised_so_case_cannot_create_a_second_account() -> None:
    signup("Prof@Example.org")

    duplicate = client.post("/api/v1/auth/signup", json=signup_payload("prof@example.ORG"))

    assert duplicate.status_code == 409
    login = client.post(
        "/api/v1/auth/login", json={"email": "PROF@example.org", "authSecret": AUTH_SECRET}
    )
    assert login.status_code == 200


@pytest.mark.usefixtures("clean_database")
def test_signup_then_login_refresh_and_logout() -> None:
    signup()

    login = client.post(
        "/api/v1/auth/login", json={"email": "prof@example.org", "authSecret": AUTH_SECRET}
    )
    assert login.status_code == 200
    refresh_token = login.json()["refreshToken"]

    refreshed = client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})
    assert refreshed.status_code == 200
    rotated = refreshed.json()["refreshToken"]
    assert rotated != refresh_token

    # Rotation means the presented token dies immediately: a stolen copy is
    # usable at most once.
    replayed = client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})
    assert replayed.status_code == 401

    assert client.post("/api/v1/auth/logout", json={"refreshToken": rotated}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refreshToken": rotated}).status_code == 401


@pytest.mark.usefixtures("clean_database")
def test_a_wrong_secret_and_an_unknown_account_are_indistinguishable() -> None:
    signup()

    wrong_secret = client.post(
        "/api/v1/auth/login", json={"email": "prof@example.org", "authSecret": OTHER_AUTH_SECRET}
    )
    unknown_email = client.post(
        "/api/v1/auth/login", json={"email": "personne@example.org", "authSecret": AUTH_SECRET}
    )

    assert wrong_secret.status_code == unknown_email.status_code == 401
    assert wrong_secret.json() == unknown_email.json() == {"detail": WRONG_CREDENTIALS}


@pytest.mark.usefixtures("clean_database")
def test_kdf_params_never_reveal_whether_an_account_exists() -> None:
    signup()

    known = client.get("/api/v1/auth/kdf-params", params={"email": "prof@example.org"})
    unknown = client.get("/api/v1/auth/kdf-params", params={"email": "personne@example.org"})
    unknown_again = client.get("/api/v1/auth/kdf-params", params={"email": "personne@example.org"})

    assert known.status_code == unknown.status_code == 200
    assert known.json()["kdfSalt"] == KDF_SALT
    assert unknown.json().keys() == known.json().keys()
    # A decoy that changed between calls would give the game away as plainly as
    # a 404 would.
    assert unknown.json() == unknown_again.json()
    assert unknown.json()["kdfSalt"] != known.json()["kdfSalt"]


@pytest.mark.usefixtures("clean_database")
def test_me_requires_a_valid_access_token() -> None:
    access_token = signup()["accessToken"]

    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.get("/api/v1/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401
    )

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    assert me.json()["user"]["firstName"] == "Camille"
    assert me.json()["crypto"]["wrappedDek"] == WRAPPED_DEK


@pytest.mark.usefixtures("clean_database")
def test_a_refresh_token_is_not_accepted_as_an_access_token() -> None:
    session = signup()

    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {session['refreshToken']}"}
    )

    assert response.status_code == 401


@pytest.mark.usefixtures("clean_database")
def test_changing_the_password_rewraps_the_key_and_signs_other_devices_out() -> None:
    session = signup()
    new_salt = base64.b64encode(b"t" * 16).decode()
    new_wrapped = base64.b64encode(b"x" * 48).decode()

    changed = client.post(
        "/api/v1/auth/password",
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        json={
            "currentAuthSecret": AUTH_SECRET,
            "newAuthSecret": OTHER_AUTH_SECRET,
            "kdfSalt": new_salt,
            "kdfIterations": 600_000,
            "wrappedDek": new_wrapped,
            "dekNonce": DEK_NONCE,
        },
    )

    assert changed.status_code == 200
    assert changed.json()["crypto"]["wrappedDek"] == new_wrapped
    # Every session opened under the old password is gone.
    assert (
        client.post(
            "/api/v1/auth/refresh", json={"refreshToken": session["refreshToken"]}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "prof@example.org", "authSecret": AUTH_SECRET}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "prof@example.org", "authSecret": OTHER_AUTH_SECRET},
        ).status_code
        == 200
    )


@pytest.mark.usefixtures("clean_database")
def test_changing_the_password_requires_the_current_one() -> None:
    session = signup()

    response = client.post(
        "/api/v1/auth/password",
        headers={"Authorization": f"Bearer {session['accessToken']}"},
        json={
            "currentAuthSecret": OTHER_AUTH_SECRET,
            "newAuthSecret": OTHER_AUTH_SECRET,
            "kdfSalt": KDF_SALT,
            "kdfIterations": 600_000,
            "wrappedDek": WRAPPED_DEK,
            "dekNonce": DEK_NONCE,
        },
    )

    assert response.status_code == 401


@pytest.mark.usefixtures("clean_database")
def test_deleting_the_account_leaves_nothing_to_sign_in_to() -> None:
    session = signup()
    headers = {"Authorization": f"Bearer {session['accessToken']}"}

    assert client.delete("/api/v1/account", headers=headers).status_code == 204

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/refresh", json={"refreshToken": session["refreshToken"]}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "prof@example.org", "authSecret": AUTH_SECRET}
        ).status_code
        == 401
    )
    # The address is free again, which is what "right to erasure" has to mean.
    assert client.post("/api/v1/auth/signup", json=signup_payload()).status_code == 201


@pytest.mark.usefixtures("clean_database")
def test_repeated_failures_lock_the_account_out_before_the_password_is_found() -> None:
    signup()
    wrong = {"email": "prof@example.org", "authSecret": OTHER_AUTH_SECRET}

    for _ in range(login_throttle.max_failures):
        assert client.post("/api/v1/auth/login", json=wrong).status_code == 401

    locked_out = client.post("/api/v1/auth/login", json=wrong)
    assert locked_out.status_code == 429
    # The lockout holds even once the caller finally guesses right.
    with_the_right_secret = client.post(
        "/api/v1/auth/login", json={"email": "prof@example.org", "authSecret": AUTH_SECRET}
    )
    assert with_the_right_secret.status_code == 429


@pytest.mark.usefixtures("clean_database")
def test_a_weakened_key_derivation_is_refused() -> None:
    """A tampered client must not be able to lower a user's iteration count."""
    response = client.post("/api/v1/auth/signup", json=signup_payload(kdfIterations=1_000))

    assert response.status_code == 422
