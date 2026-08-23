"""Model package.

Importing every model here is what makes Alembic's autogenerate see them: it
reads `Base.metadata`, which is only populated by the classes actually imported.
"""

from app.models.base import Base, TimestampMixin
from app.models.sync_record import SyncRecord
from app.models.user import RefreshToken, User

__all__ = ["Base", "RefreshToken", "SyncRecord", "TimestampMixin", "User"]
