"""Business logic for task comments: listing and CRUD.

Authorization (project membership, who may post, who may delete) is enforced by
the router; this layer only handles persistence.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.comment import Comment


def list_comments(db: Session, task_id: uuid.UUID) -> list[Comment]:
    """Return a task's comments, oldest first, with each author loaded."""
    return list(
        db.scalars(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.task_id == task_id)
            .order_by(Comment.created_at, Comment.id)
        )
    )


def get_comment(
    db: Session, task_id: uuid.UUID, comment_id: uuid.UUID
) -> Comment | None:
    """Return a comment only if it belongs to ``task_id``."""
    comment = db.get(Comment, comment_id)
    if comment is None or comment.task_id != task_id:
        return None
    return comment


def create_comment(
    db: Session, task_id: uuid.UUID, user_id: uuid.UUID, body: str
) -> Comment:
    comment = Comment(task_id=task_id, user_id=user_id, body=body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment: Comment) -> None:
    db.delete(comment)
    db.commit()
