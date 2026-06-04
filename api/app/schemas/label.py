import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.label import LABEL_COLORS


def _validate_color(value: str) -> str:
    color = value.upper()
    if color not in LABEL_COLORS:
        raise ValueError("color must be one of the preset label colors")
    return color


class LabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: str

    @field_validator("color")
    @classmethod
    def check_color(cls, value: str) -> str:
        return _validate_color(value)


class LabelUpdate(BaseModel):
    """Partial update; only the fields the client sends are applied."""

    name: str | None = Field(default=None, min_length=1, max_length=40)
    color: str | None = None

    @field_validator("color")
    @classmethod
    def check_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_color(value)


class LabelRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)


class TaskLabelApply(BaseModel):
    label_id: uuid.UUID
