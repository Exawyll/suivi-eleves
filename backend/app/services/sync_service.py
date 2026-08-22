import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_record import SyncRecord
from app.repositories.sync_repository import SyncRepository
from app.schemas.sync import (
    AppliedRecord,
    PullResponse,
    PushRecord,
    PushResponse,
    RecordEnvelope,
    SyncStatusResponse,
)


def _envelope(record: SyncRecord) -> RecordEnvelope:
    return RecordEnvelope(
        entity_type=record.entity_type,
        entity_id=record.entity_id,
        revision=record.revision,
        client_updated_at=record.client_updated_at,
        deleted=record.deleted,
        ciphertext=record.ciphertext,
        nonce=record.nonce,
    )


class SyncService:
    """Moves opaque envelopes in and out, for one account."""

    def __init__(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        self.records = SyncRepository(db, user_id)

    async def pull(self, since: int, limit: int) -> PullResponse:
        records, has_more = await self.records.changes_since(since, limit)
        envelopes = [_envelope(record) for record in records]
        # Staying on `since` when nothing came back matters: advancing the
        # cursor past a revision the client never saw would lose the record for
        # good, since the next pull starts above it.
        next_cursor = envelopes[-1].revision if envelopes else since
        return PullResponse(records=envelopes, next_cursor=next_cursor, has_more=has_more)

    async def push(self, records: list[PushRecord]) -> PushResponse:
        """Stores envelopes and reports the ones the server's version outranks.

        Deliberately returns no cursor. Handing back the account's head
        revision here would be a data-loss trap: a device sitting at revision 5
        while another has pushed up to 20 would be told 21 after its own push,
        and every pull from then on would start above the fifteen records it
        never saw. A pull cursor may only ever advance through a pull.
        """
        applied: list[AppliedRecord] = []
        rejected: list[tuple[str, str]] = []

        for record in records:
            revision = await self.records.upsert(record)
            if revision is None:
                rejected.append((record.entity_type, record.entity_id))
                continue
            applied.append(
                AppliedRecord(
                    entity_type=record.entity_type,
                    entity_id=record.entity_id,
                    revision=revision,
                )
            )

        # Re-read rather than reuse anything from before the writes: another
        # device of the same account may have pushed in between, and the client
        # has to be handed the version that actually stands.
        conflicts = [_envelope(record) for record in await self.records.get_many(rejected)]
        return PushResponse(applied=applied, conflicts=conflicts)

    async def status(self) -> SyncStatusResponse:
        return SyncStatusResponse(
            server_revision=await self.records.head_revision(),
            record_count=await self.records.count(),
        )
