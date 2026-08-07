from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, HttpUrl


class CreateRunRequest(BaseModel):
    project_id: str
    environment_id: str | None = None
    target_url: HttpUrl
    login_email: EmailStr | None = None
    login_password: str | None = None


class RunResponse(BaseModel):
    id: str
    project_id: str
    environment_id: str | None = None
    target_url: HttpUrl
    status: Literal["queued", "running", "analyzing", "completed", "failed", "cancelled"]
    created_at: datetime
    updated_at: datetime
    artifact_dir: str | None = None
    error_message: str | None = None
