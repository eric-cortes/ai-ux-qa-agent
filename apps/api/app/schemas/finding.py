from typing import Literal

from pydantic import BaseModel


class FindingResponse(BaseModel):
    id: str
    run_id: str
    category: Literal["ux", "accessibility", "functional", "network", "performance"]
    title: str
    description: str
    severity: Literal["low", "medium", "high", "critical"]
    confidence: float
    page_url: str
    observed_behavior: str
    reproduction_steps: list[str]
    evidence_ids: list[str] = []
    guideline_id: str | None = None
    guideline_source_url: str | None = None
    verification_status: Literal["confirmed", "likely", "needs_human_review"] = "needs_human_review"
    status: Literal["open", "accepted", "rejected", "fixed"] = "open"
