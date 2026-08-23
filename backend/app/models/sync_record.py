import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    Sequence,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# One global sequence rather than a counter per account: a strictly increasing
# number is all a client needs as a cursor, and per-user counters would have to
# be locked and incremented by hand on every write.
revision_sequence = Sequence("seq_sync_records_revision")

ENTITY_ID_MAX_LENGTH = 64


class SyncRecord(Base, TimestampMixin):
    """One encrypted envelope, opaque to this server.

    The server arbitrates on the plaintext metadata only — revision, client
    timestamp, tombstone — and never on the contents, which it cannot read. It
    therefore knows how many records an account holds and when each was
    touched, but not a single student's name.
    """

    __tablename__ = "sync_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    entity_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    # A string, not a UUID: frontend/src/utils/id.ts falls back to
    # `id-<timestamp>-<random>` where crypto.randomUUID is unavailable, and
    # carnets written before this change may already hold such ids. A UUID
    # column would reject them and lose the record on its first upload.
    entity_id: Mapped[str] = mapped_column(String(ENTITY_ID_MAX_LENGTH), primary_key=True)
    revision: Mapped[int] = mapped_column(
        BigInteger,
        revision_sequence,
        server_default=revision_sequence.next_value(),
        unique=True,
        nullable=False,
    )
    # NULL on a tombstone: a deleted record keeps its identity and its place in
    # the revision order, but carries nothing left to decrypt.
    ciphertext: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    nonce: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    client_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))

    __table_args__ = (
        # Pulling is always "everything of mine above revision N", which this
        # index answers without touching the other accounts' rows.
        Index("ix_sync_records_user_id_revision", "user_id", "revision"),
    )
