import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sync_record import SyncRecord
from app.schemas.sync import PushRecord


class SyncRepository:
    """Every read and write of `sync_records`, for one account.

    The account is fixed at construction and comes from the access token. No
    method here takes a user id, so there is no signature into which a value
    from a request body could be passed by mistake — which is the whole of what
    keeps one teacher's carnet out of another's reach.
    """

    def __init__(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        self.db = db
        self.user_id = user_id

    async def changes_since(self, since: int, limit: int) -> tuple[Sequence[SyncRecord], bool]:
        """Records above `since`, oldest first, plus whether more remain.

        Asks for one row beyond the limit rather than issuing a second COUNT:
        its presence is exactly the question `has_more` answers.
        """
        result = await self.db.execute(
            select(SyncRecord)
            .where(SyncRecord.user_id == self.user_id, SyncRecord.revision > since)
            .order_by(SyncRecord.revision)
            .limit(limit + 1)
        )
        rows = result.scalars().all()
        return rows[:limit], len(rows) > limit

    async def upsert(self, record: PushRecord) -> int | None:
        """Stores one envelope, or returns None if the server's version wins.

        The whole arbitration happens inside a single statement, so two devices
        pushing at once cannot interleave a read and a write: either the guard
        matches and the row is replaced, or nothing happens and the caller
        learns it has a conflict to resolve.
        """
        proposed = pg_insert(SyncRecord).values(
            user_id=self.user_id,
            entity_type=record.entity_type,
            entity_id=record.entity_id,
            ciphertext=record.ciphertext,
            nonce=record.nonce,
            client_updated_at=record.client_updated_at,
            deleted=record.deleted,
        )
        upsert = proposed.on_conflict_do_update(
            index_elements=[SyncRecord.user_id, SyncRecord.entity_type, SyncRecord.entity_id],
            set_={
                "ciphertext": proposed.excluded.ciphertext,
                "nonce": proposed.excluded.nonce,
                "client_updated_at": proposed.excluded.client_updated_at,
                "deleted": proposed.excluded.deleted,
                # Reusing the value already drawn for the INSERT attempt rather
                # than drawing a second one: one push, one revision.
                "revision": proposed.excluded.revision,
                "updated_at": func.now(),
            },
            where=or_(
                # The device was up to date, so it may overwrite.
                SyncRecord.revision == record.base_revision,
                # It was not, so the more recent edit wins. Equal timestamps
                # leave the server's version in place, which makes the outcome
                # the same whichever device pushes first.
                SyncRecord.client_updated_at < proposed.excluded.client_updated_at,
            ),
        ).returning(SyncRecord.revision)

        result = await self.db.execute(upsert)
        return result.scalar_one_or_none()

    async def get_many(self, keys: Sequence[tuple[str, str]]) -> Sequence[SyncRecord]:
        """The server's own version of the records a push failed to overwrite."""
        if not keys:
            return []
        result = await self.db.execute(
            select(SyncRecord).where(
                SyncRecord.user_id == self.user_id,
                tuple_(SyncRecord.entity_type, SyncRecord.entity_id).in_(keys),
            )
        )
        return result.scalars().all()

    async def head_revision(self) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.max(SyncRecord.revision), 0)).where(
                SyncRecord.user_id == self.user_id
            )
        )
        return result.scalar_one()

    async def count(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(SyncRecord).where(SyncRecord.user_id == self.user_id)
        )
        return result.scalar_one()
