import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.config import settings
from app.core.exceptions import AuthenticationError

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"
DECOY_SALT_BYTES = 16

# argon2id with the library's current defaults, which track the RFC 9106
# recommendations; check_needs_rehash below re-hashes on the next successful
# login if those defaults are raised later.
_hasher = PasswordHasher()


def hash_auth_secret(auth_secret: str) -> str:
    return _hasher.hash(auth_secret)


def verify_auth_secret(auth_secret: str, auth_hash: str) -> bool:
    try:
        _hasher.verify(auth_hash, auth_secret)
    except VerifyMismatchError, VerificationError, InvalidHashError:
        return False
    return True


def auth_hash_needs_upgrade(auth_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(auth_hash)
    except InvalidHashError:
        return False


def create_access_token(user_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=settings.access_token_ttl_seconds),
        "typ": ACCESS_TOKEN_TYPE,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    """Returns the user id a valid access token carries.

    Every failure mode — bad signature, expiry, a refresh token presented as an
    access token, a malformed subject — collapses into the same error: the
    caller is not authenticated, and which of these went wrong is not the
    client's business.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise AuthenticationError from exc

    if payload.get("typ") != ACCESS_TOKEN_TYPE:
        raise AuthenticationError

    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise AuthenticationError from exc


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decoy_kdf_salt(email: str) -> bytes:
    """A stable, plausible salt for an email that has no account.

    /auth/kdf-params has to answer before the password is known, so answering
    "unknown email" there would hand anyone a way to test whether a colleague
    has an account. Deriving the decoy from the server secret keeps the answer
    identical across calls — a salt that changed on every request would give
    the game away just as plainly.
    """
    digest = hmac.new(
        settings.secret_key.encode(),
        f"carnet:kdf-salt:{email}".encode(),
        hashlib.sha256,
    ).digest()
    return digest[:DECOY_SALT_BYTES]
