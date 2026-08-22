import asyncio
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from alembic import command
from app.config import settings
from app.database import get_db
from app.models import Base
from main import app

BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Tests get their own database, never the one DATABASE_URL points at: running
# the suite must not be able to truncate a developer's local carnet.
APP_URL = make_url(settings.database_url)
TEST_URL = APP_URL.set(database=f"{APP_URL.database}_test")

# NullPool because Starlette's TestClient runs each request in its own event
# loop: a pooled asyncpg connection opened for one request would be reused from
# a different loop on the next and blow up.
test_engine = create_async_engine(TEST_URL, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_db() -> AsyncGenerator[AsyncSession]:
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def _create_database_if_missing() -> None:
    """Connects to the maintenance database to create the scratch one.

    AUTOCOMMIT because Postgres refuses CREATE DATABASE inside a transaction.
    """
    admin_engine = create_async_engine(
        APP_URL.set(database="postgres"), poolclass=NullPool, isolation_level="AUTOCOMMIT"
    )
    try:
        async with admin_engine.connect() as connection:
            exists = await connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": TEST_URL.database},
            )
            if not exists:
                await connection.execute(text(f'CREATE DATABASE "{TEST_URL.database}"'))
    finally:
        await admin_engine.dispose()


def alembic_config(url: URL) -> Config:
    """Alembic pointed at `url` rather than at the application's database."""
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False))
    return config


def _migrate(url: URL) -> None:
    """Builds the schema by running the real migrations, not create_all.

    That way every run proves the Alembic revisions still produce the schema
    the code expects — a create_all suite stays green while production drifts.
    """
    command.upgrade(alembic_config(url), "head")


async def _truncate(url: URL) -> None:
    tables = ", ".join(f'"{name}"' for name in Base.metadata.tables)
    engine = create_async_engine(url, poolclass=NullPool)
    try:
        async with engine.begin() as connection:
            await connection.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def database() -> Iterator[None]:
    """Prepares the scratch database, or skips the tests that need one.

    Skipping rather than failing keeps the suite runnable on a laptop with no
    Postgres; CI always has one, so the coverage is never silently lost there.
    """
    try:
        asyncio.run(_create_database_if_missing())
        _migrate(TEST_URL)
    except (OSError, SQLAlchemyError) as exc:
        pytest.skip(f"Postgres unreachable ({exc})", allow_module_level=True)

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def migration_config(database: None) -> Config:
    """Alembic, aimed at the scratch database the schema was built in."""
    return alembic_config(TEST_URL)


@pytest.fixture
def clean_database(database: None) -> Iterator[None]:
    """Every test starts from an empty database, in whatever order they run."""
    asyncio.run(_truncate(TEST_URL))
    yield
