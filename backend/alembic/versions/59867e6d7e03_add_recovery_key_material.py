"""add recovery key material

Revision ID: 59867e6d7e03
Revises: 95eedd6eda68
Create Date: 2026-09-05 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "59867e6d7e03"
down_revision: str | None = "95eedd6eda68"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("recovery_auth_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("wrapped_dek_recovery", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("dek_nonce_recovery", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "dek_nonce_recovery")
    op.drop_column("users", "wrapped_dek_recovery")
    op.drop_column("users", "recovery_auth_hash")
