"""Add index on project_members.user_id.

Revision ID: 20260519_0005
Revises: 20260518_0004
Create Date: 2026-05-19
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260519_0005"
down_revision: str | Sequence[str] | None = "20260518_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_project_members_user_id",
        "project_members",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_members_user_id", table_name="project_members")
