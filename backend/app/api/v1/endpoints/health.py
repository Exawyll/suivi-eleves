from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

router = APIRouter(tags=["health"])


class DatabaseHealth(BaseModel):
    status: Literal["ok", "degraded"]
    environment: str
    database: Literal["ok", "unavailable"]


@router.get("/health/db")
async def database_health(db: Annotated[AsyncSession, Depends(get_db)]) -> DatabaseHealth:
    """Reports whether the API can actually reach Postgres.

    The plain /health endpoint answers "is the process up", which stays green
    even when the database is unreachable — the failure mode worth catching.
    """
    try:
        await db.execute(text("SELECT 1"))
    # Deliberately broad: a probe that can itself 500 is useless, and an
    # unreachable host surfaces as a bare OSError rather than a SQLAlchemy one.
    except Exception:
        return DatabaseHealth(
            status="degraded",
            environment=settings.environment,
            database="unavailable",
        )
    return DatabaseHealth(status="ok", environment=settings.environment, database="ok")
