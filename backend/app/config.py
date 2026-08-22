from typing import Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-insecure-change-me-before-deploying"
# 32 hex chars is what `openssl rand -hex 32` yields; shorter means someone typed it.
MIN_PRODUCTION_SECRET_LENGTH = 32


class Settings(BaseSettings):
    """Application settings, read from the environment (and a local .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    debug: bool = False

    # Credential-free on purpose: asyncpg falls back to the OS user and the
    # standard PG* variables locally, and production always supplies its own
    # DSN. Committing a user:password pair here would put a credential-shaped
    # string in the repository for no benefit.
    database_url: str = "postgresql+asyncpg://localhost:5432/carnet"
    secret_key: str = DEV_SECRET_KEY

    access_token_ttl_seconds: int = 900
    refresh_token_ttl_days: int = 30

    @field_validator("database_url")
    @classmethod
    def force_async_driver(cls, value: str) -> str:
        """Railway injects a sync DSN; SQLAlchemy's async engine needs asyncpg.

        Rewriting here rather than at every call site means the deployment can
        keep using the platform-provided variable untouched.
        """
        for prefix in ("postgresql+asyncpg://", "postgresql+psycopg://"):
            if value.startswith(prefix):
                return value
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+asyncpg://" + value[len(prefix) :]
        return value

    @model_validator(mode="after")
    def require_a_strong_secret_in_production(self) -> Self:
        """A placeholder, blank or short secret must never sign real tokens.

        Checking only against the placeholder left a hole: copying .env.example
        and clearing the line yields an empty secret, which is not the
        placeholder and would have passed.
        """
        if self.environment != "production":
            return self
        if self.secret_key == DEV_SECRET_KEY:
            raise ValueError("SECRET_KEY must be set to a real value when ENVIRONMENT=production")
        if len(self.secret_key) < MIN_PRODUCTION_SECRET_LENGTH:
            raise ValueError(
                "SECRET_KEY must be at least "
                f"{MIN_PRODUCTION_SECRET_LENGTH} characters when ENVIRONMENT=production"
            )
        return self


settings = Settings()
