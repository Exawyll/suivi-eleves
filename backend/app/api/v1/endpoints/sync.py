from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.sync import (
    DEFAULT_PULL_LIMIT,
    MAX_PULL_LIMIT,
    PullResponse,
    PushRequest,
    PushResponse,
    SyncStatusResponse,
)
from app.services.sync_service import SyncService

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/changes")
async def pull_changes(
    user: CurrentUser,
    db: DbSession,
    since: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=MAX_PULL_LIMIT)] = DEFAULT_PULL_LIMIT,
) -> PullResponse:
    """Everything of this account's that changed after `since`, oldest first."""
    return await SyncService(db, user.id).pull(since, limit)


@router.post("/changes")
async def push_changes(payload: PushRequest, user: CurrentUser, db: DbSession) -> PushResponse:
    """Stores envelopes, and reports the ones the server's version outranks."""
    return await SyncService(db, user.id).push(payload.records)


@router.get("/status")
async def sync_status(user: CurrentUser, db: DbSession) -> SyncStatusResponse:
    return await SyncService(db, user.id).status()
