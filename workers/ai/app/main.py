from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


VALID_CATEGORIES = {"ux", "accessibility", "functional", "network", "performance"}
VALID_SEVERITIES = {"low", "medium", "high", "critical"}

FindingCategory = Literal["ux", "accessibility", "functional", "network", "performance"]
FindingSeverity = Literal["low", "medium", "high", "critical"]


class Finding(BaseModel):
    id: str
    run_id: str
    category: FindingCategory
    title: str
    description: str
    severity: FindingSeverity
    confidence: float
    page_url: str
    observed_behavior: str
    reproduction_steps: list[str]
    evidence_ids: list[str]
    status: str = "open"


def normalize_category(value: Any) -> FindingCategory:
    normalized = str(value or "ux").strip().lower()
    return normalized if normalized in VALID_CATEGORIES else "ux"


def normalize_severity(value: Any) -> FindingSeverity:
    normalized = str(value or "medium").strip().lower()
    return normalized if normalized in VALID_SEVERITIES else "medium"


SYSTEM_PROMPT = """
You are an AI UX QA reviewer.
Analyze the provided browser evidence and return JSON only.
Be evidence-based and avoid speculation.
If no meaningful issues are found, return an empty findings array.
""".strip()


def fallback_findings(run_id: str, evidence: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    page_url = evidence.get("finalUrl") or evidence.get("targetUrl") or ""

    if evidence.get("failedRequests"):
        findings.append(
            Finding(
                id=f"finding_{uuid4().hex[:8]}",
                run_id=run_id,
                category="network",
                title="Failed network requests detected",
                description="One or more network requests failed during the QA run.",
                severity="medium",
                confidence=0.9,
                page_url=page_url,
                observed_behavior="The browser recorded request failures.",
                reproduction_steps=[
                    "Open the target page",
                    "Repeat the captured flow",
                    "Inspect the network panel for failed requests",
                ],
                evidence_ids=["evidence.json"],
            )
        )

    if evidence.get("errorResponses"):
        findings.append(
            Finding(
                id=f"finding_{uuid4().hex[:8]}",
                run_id=run_id,
                category="functional",
                title="HTTP error responses were returned",
                description="The application returned one or more HTTP responses with status 400 or higher.",
                severity="medium",
                confidence=0.88,
                page_url=page_url,
                observed_behavior="Error responses were captured while executing the page flow.",
                reproduction_steps=[
                    "Open the target page",
                    "Repeat the captured flow",
                    "Inspect network responses with error status codes",
                ],
                evidence_ids=["evidence.json"],
            )
        )

    violations = evidence.get("axeViolations") or []
    if violations:
        first = violations[0]
        findings.append(
            Finding(
                id=f"finding_{uuid4().hex[:8]}",
                run_id=run_id,
                category="accessibility",
                title=f"Accessibility issue: {first.get('id', 'axe violation')}",
                description=first.get("description") or "axe-core found an accessibility issue.",
                severity="high",
                confidence=0.95,
                page_url=page_url,
                observed_behavior=first.get("help") or "Accessibility rules were violated on the page.",
                reproduction_steps=[
                    "Open the target page",
                    "Run the accessibility scan",
                    "Review the reported violation and affected elements",
                ],
                evidence_ids=["evidence.json", "page.png"],
            )
        )

    console_messages = evidence.get("consoleMessages") or []
    severe_console = [message for message in console_messages if "error" in message.lower()]
    if severe_console:
        findings.append(
            Finding(
                id=f"finding_{uuid4().hex[:8]}",
                run_id=run_id,
                category="functional",
                title="Console errors detected during execution",
                description="The browser console recorded one or more error messages.",
                severity="medium",
                confidence=0.85,
                page_url=page_url,
                observed_behavior="Console error output was captured while the page was loading or interacting.",
                reproduction_steps=[
                    "Open the target page",
                    "Repeat the captured flow",
                    "Inspect browser console output",
                ],
                evidence_ids=["evidence.json"],
            )
        )

    return findings


def generate_with_openai(run_id: str, evidence: dict[str, Any]) -> list[Finding]:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    if not api_key or OpenAI is None:
        return fallback_findings(run_id, evidence)

    client = OpenAI(api_key=api_key)
    prompt = json.dumps({"run_id": run_id, "evidence": evidence}, ensure_ascii=False)

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Return an object with a 'findings' array. "
                        "Each finding must include: category, title, description, severity, confidence, "
                        "page_url, observed_behavior, reproduction_steps, evidence_ids.\n\n" + prompt
                    ),
                },
            ],
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        findings: list[Finding] = []
        for item in payload.get("findings", []):
            findings.append(
                Finding(
                    id=f"finding_{uuid4().hex[:8]}",
                    run_id=run_id,
                    category=normalize_category(item.get("category", "ux")),
                    title=item.get("title", "Untitled finding"),
                    description=item.get("description", ""),
                    severity=normalize_severity(item.get("severity", "medium")),
                    confidence=float(item.get("confidence", 0.5)),
                    page_url=item.get("page_url") or evidence.get("finalUrl") or evidence.get("targetUrl") or "",
                    observed_behavior=item.get("observed_behavior", ""),
                    reproduction_steps=item.get("reproduction_steps", []),
                    evidence_ids=item.get("evidence_ids", ["evidence.json"]),
                )
            )
        return findings
    except Exception:
        return fallback_findings(run_id, evidence)


def main() -> None:
    run_id = os.getenv("RUN_ID")
    artifact_dir = Path(os.getenv("ARTIFACT_LOCAL_DIR", "./storage/artifacts"))
    if not run_id:
        raise SystemExit("RUN_ID is required")

    run_dir = artifact_dir / run_id
    evidence_path = run_dir / "evidence.json"
    if not evidence_path.exists():
        raise SystemExit(f"Evidence file not found: {evidence_path}")

    evidence = json.loads(evidence_path.read_text())
    findings = generate_with_openai(run_id, evidence)
    output = {"findings": [finding.model_dump() for finding in findings]}
    (run_dir / "findings.json").write_text(json.dumps(output, indent=2))
    print(f"Saved findings to {(run_dir / 'findings.json').resolve()}")


if __name__ == "__main__":
    main()
