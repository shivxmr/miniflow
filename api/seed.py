from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.enums import TaskPriority, TaskStatus, UserRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.user import User

SEED_PASSWORD_HASH = "seed-only-placeholder-until-auth-step"


def run() -> None:
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == "admin@miniflow.test"))
        if existing:
            print("Seed data already exists.")
            return

        admin = User(
            name="Avery Admin",
            email="admin@miniflow.test",
            password_hash=SEED_PASSWORD_HASH,
            role=UserRole.ADMIN,
        )
        member = User(
            name="Mina Member",
            email="member@miniflow.test",
            password_hash=SEED_PASSWORD_HASH,
            role=UserRole.MEMBER,
        )
        viewer = User(
            name="Vik Viewer",
            email="viewer@miniflow.test",
            password_hash=SEED_PASSWORD_HASH,
            role=UserRole.VIEWER,
        )
        db.add_all([admin, member, viewer])
        db.flush()

        project = Project(
            name="MiniFlow Launch",
            description="Seed project for validating the Step 2 data model.",
            created_by=admin.id,
        )
        db.add(project)
        db.flush()

        db.add_all(
            [
                ProjectMember(project_id=project.id, user_id=admin.id, role=UserRole.ADMIN),
                ProjectMember(project_id=project.id, user_id=member.id, role=UserRole.MEMBER),
                ProjectMember(project_id=project.id, user_id=viewer.id, role=UserRole.VIEWER),
                Task(
                    project_id=project.id,
                    title="Finalize API schema",
                    description="Confirm project and task shapes before auth work.",
                    assigned_to=member.id,
                    status=TaskStatus.TODO,
                    priority=TaskPriority.HIGH,
                    due_date=date.today() + timedelta(days=2),
                    created_by=admin.id,
                ),
                Task(
                    project_id=project.id,
                    title="Review RBAC matrix",
                    assigned_to=viewer.id,
                    status=TaskStatus.IN_PROGRESS,
                    priority=TaskPriority.MEDIUM,
                    due_date=date.today() + timedelta(days=4),
                    created_by=admin.id,
                ),
                Task(
                    project_id=project.id,
                    title="Prepare frontend shell",
                    status=TaskStatus.DONE,
                    priority=TaskPriority.LOW,
                    created_by=member.id,
                ),
            ]
        )
        db.commit()
        print("Seed data created.")


if __name__ == "__main__":
    run()
