import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

#: The fixed palette of label colors. Labels may only use one of these preset
#: hex values; the schema rejects anything else.
LABEL_COLORS: frozenset[str] = frozenset(
    {
        "#E11D48",  # rose
        "#DB2777",  # pink
        "#C026D3",  # fuchsia
        "#9333EA",  # purple
        "#6366F1",  # indigo
        "#2563EB",  # blue
        "#0891B2",  # cyan
        "#059669",  # emerald
        "#65A30D",  # lime
        "#CA8A04",  # yellow
        "#EA580C",  # orange
        "#57534E",  # stone
    }
)

#: The maximum number of labels that may be applied to a single task.
MAX_LABELS_PER_TASK = 5

#: Join table linking tasks to labels. Both sides cascade on delete, so removing
#: a task or a label removes the association rows automatically.
task_labels = Table(
    "task_labels",
    Base.metadata,
    Column(
        "task_id",
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "label_id",
        UUID(as_uuid=True),
        ForeignKey("labels.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Label(Base):
    """A colored, project-scoped tag that can be applied to tasks.

    Names are unique within a project. Deleting a label cascades to the
    ``task_labels`` join rows, removing it from every task that carried it.
    """

    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_labels_project_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    tasks = relationship("Task", secondary=task_labels, back_populates="labels")
