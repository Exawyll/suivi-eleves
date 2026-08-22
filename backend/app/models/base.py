from datetime import datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Postgres names constraints after its own scheme (users_pkey, users_email_key),
# which the workspace conventions do not follow and Alembic cannot guess when it
# has to drop one. Declaring the scheme once here makes every future migration
# refer to a name we chose.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    """Every business table carries these, per the workspace conventions.

    Timezone-aware on purpose: the clients are spread across devices and the
    sync protocol compares timestamps, which a naive column would make
    ambiguous the first time a deployment moved.
    """

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
