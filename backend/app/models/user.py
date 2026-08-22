import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """A teacher's account.

    The server never sees the password: the client derives an `auth_secret`
    from it and only that is sent, then re-hashed with argon2id here. The
    key-derivation parameters and the wrapped data key are stored so a fresh
    device can be unlocked from the password alone — but the key that unwraps
    them never leaves the client, so none of this lets the server read a
    carnet.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Lower-cased before it ever reaches this column, rather than relying on
    # citext: one fewer Postgres extension to have enabled on every environment.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    auth_hash: Mapped[str] = mapped_column(String(255))
    kdf_salt: Mapped[bytes] = mapped_column(LargeBinary)
    kdf_iterations: Mapped[int] = mapped_column(Integer)
    wrapped_dek: Mapped[bytes] = mapped_column(LargeBinary)
    dek_nonce: Mapped[bytes] = mapped_column(LargeBinary)


class RefreshToken(Base, TimestampMixin):
    """One row per issued refresh token, stored hashed and rotated on use.

    Only the SHA-256 of the token is kept: a leaked database backup cannot be
    replayed against the API. A fast hash is the right choice here, unlike for
    the auth secret — the token is 32 random bytes, so there is nothing to
    guess and the row has to be found by its hash.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
