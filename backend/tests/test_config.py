import pytest

from app.config import DEV_SECRET_KEY, MIN_PRODUCTION_SECRET_LENGTH, Settings

STRONG_SECRET = "s" * MIN_PRODUCTION_SECRET_LENGTH
# Host and database only: a user:password pair here would be a credential-shaped
# literal in the repository, which is what secret scanners flag.
SYNC_DSN = "postgresql://db.internal:5432/carnet"
ASYNC_DSN = "postgresql+asyncpg://db.internal:5432/carnet"


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        (SYNC_DSN, ASYNC_DSN),
        ("postgres://db.internal:5432/carnet", ASYNC_DSN),
        (ASYNC_DSN, ASYNC_DSN),
    ],
)
def test_database_url_is_rewritten_for_asyncpg(given: str, expected: str) -> None:
    """Railway hands over a sync DSN; the async engine cannot use it as-is."""
    assert Settings(database_url=given).database_url == expected


def test_the_default_dsn_carries_no_credentials() -> None:
    """Nothing credential-shaped ships in the repository.

    Reads the declared default rather than an instance: Settings() picks up
    DATABASE_URL from the environment, so in CI this would have asserted
    against the runner's connection string instead of the committed value.
    """
    default = Settings.model_fields["database_url"].default

    assert isinstance(default, str)
    assert "@" not in default


def test_production_refuses_the_development_secret() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(environment="production", secret_key=DEV_SECRET_KEY)


def test_production_refuses_a_blank_or_short_secret() -> None:
    """Clearing the line in .env.example must not pass for a real secret."""
    for weak in ("", "trop-court"):
        with pytest.raises(ValueError, match="SECRET_KEY"):
            Settings(environment="production", secret_key=weak)


def test_development_tolerates_a_weak_secret() -> None:
    """The guard is production-only; local work must stay frictionless."""
    assert Settings(environment="development", secret_key="").secret_key == ""


def test_production_accepts_a_strong_secret() -> None:
    assert Settings(environment="production", secret_key=STRONG_SECRET).secret_key == STRONG_SECRET
