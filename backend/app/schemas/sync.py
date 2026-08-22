from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, Base64Bytes, Field, model_validator

from app.schemas.base import Base64Out, CarnetSchema

# The seven kinds of record a carnet holds. A Literal rather than a free string:
# the server cannot read the envelopes, so this list is the only structural
# check it can make on what it is asked to store.
EntityType = Literal[
    "etablissement",
    "classe",
    "eleve",
    "tagCategory",
    "tag",
    "event",
    "preference",
]

MAX_CIPHERTEXT_BYTES = 64 * 1024
MAX_RECORDS_PER_PUSH = 500
MAX_PULL_LIMIT = 500
DEFAULT_PULL_LIMIT = 200

EntityId = Annotated[str, Field(min_length=1, max_length=64)]
Ciphertext = Annotated[Base64Bytes, Field(min_length=1, max_length=MAX_CIPHERTEXT_BYTES)]
Nonce = Annotated[Base64Bytes, Field(min_length=12, max_length=16)]


class PushRecord(CarnetSchema):
    entity_type: EntityType
    entity_id: EntityId
    # The revision this device last saw. None on a record it believes is new.
    base_revision: int | None = None
    client_updated_at: AwareDatetime
    deleted: bool = False
    ciphertext: Ciphertext | None = None
    nonce: Nonce | None = None

    @model_validator(mode="after")
    def envelope_matches_the_tombstone_flag(self) -> Self:
        """A record is either an envelope or a tombstone, never both or neither.

        Without this, a client bug could store a live record with no contents,
        which no device could ever decrypt and none could tell from a deletion.
        """
        if self.deleted:
            if self.ciphertext is not None or self.nonce is not None:
                raise ValueError("Un enregistrement supprimé ne porte ni ciphertext ni nonce.")
            return self
        if self.ciphertext is None or self.nonce is None:
            raise ValueError("Un enregistrement vivant doit porter un ciphertext et un nonce.")
        return self


class PushRequest(CarnetSchema):
    records: Annotated[list[PushRecord], Field(min_length=1, max_length=MAX_RECORDS_PER_PUSH)]


class RecordEnvelope(CarnetSchema):
    """What the server hands back — the same opaque blob it was given."""

    entity_type: str
    entity_id: str
    revision: int
    client_updated_at: datetime
    deleted: bool
    ciphertext: Base64Out | None = None
    nonce: Base64Out | None = None


class AppliedRecord(CarnetSchema):
    entity_type: str
    entity_id: str
    revision: int


class PullResponse(CarnetSchema):
    records: list[RecordEnvelope]
    next_cursor: int
    has_more: bool


class PushResponse(CarnetSchema):
    applied: list[AppliedRecord]
    # Envelopes the server kept because it holds a newer version. The client
    # applies them, overwriting what it tried to push.
    conflicts: list[RecordEnvelope]
    cursor: int


class SyncStatusResponse(CarnetSchema):
    server_revision: int
    record_count: int
