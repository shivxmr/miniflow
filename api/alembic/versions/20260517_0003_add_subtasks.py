"""Add subtasks.

Revision ID: 20260517_0003
Revises: 20260516_0002
Create Date: 2026-05-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260517_0003"
down_revision: str | Sequence[str] | None = "20260516_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("is_done", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_subtasks_task_id", "subtasks", ["task_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_subtasks_task_id", table_name="subtasks")
    op.drop_table("subtasks")
