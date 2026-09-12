from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, HttpUrl, field_validator


class CreateRunRequest(BaseModel):
    project_id: str
    environment_id: str | None = None
    target_url: HttpUrl
    login_email: EmailStr | None = None
    login_password: str | None = None

    @field_validator("target_url", mode="before")
    @classmethod
    def add_default_url_scheme(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        target_url = value.strip()
        if "://" in target_url:
            return target_url
        hostname = target_url.split("/", maxsplit=1)[0].split(":", maxsplit=1)[0].lower()
        is_loopback = hostname == "localhost" or hostname.startswith("127.") or target_url.startswith("[::1]")
        if not is_loopback and "." not in hostname:
            return target_url
        return f"{'http' if is_loopback else 'https'}://{target_url}"


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
