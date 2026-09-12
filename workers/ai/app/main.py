from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from guidelines import GUIDELINES, get_guideline
from pydantic import BaseModel

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


VALID_CATEGORIES = {"ux", "accessibility", "functional", "network", "performance"}
VALID_SEVERITIES = {"low", "medium", "high", "critical"}
FindingCategory = Literal["ux", "accessibility", "functional", "network", "performance"]
FindingSeverity = Literal["low", "medium", "high", "critical"]
VerificationStatus = Literal["confirmed", "likely", "needs_human_review"]


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
    guideline_id: str | None = None
    guideline_source_url: str | None = None
    verification_status: VerificationStatus = "needs_human_review"
    status: str = "open"


def normalize_category(value: Any) -> FindingCategory:
    normalized = str(value or "ux").strip().lower()
    return normalized if normalized in VALID_CATEGORIES else "ux"


def normalize_severity(value: Any) -> FindingSeverity:
    normalized = str(value or "medium").strip().lower()
    return normalized if normalized in VALID_SEVERITIES else "medium"


def _guideline_fields(guideline_id: str) -> dict[str, str]:
    guideline = get_guideline(guideline_id)
    if guideline is None:
        raise ValueError(f"Unknown guideline ID: {guideline_id}")
    return {"guideline_id": guideline.id, "guideline_source_url": guideline.source_url}


def _finding(
    run_id: str,
    page_url: str,
    guideline_id: str,
    title: str,
    description: str,
    observed_behavior: str,
    reproduction_steps: list[str],
    evidence_ids: list[str],
    confidence: float,
    verification_status: VerificationStatus,
    severity: FindingSeverity | None = None,
    category: FindingCategory | None = None,
) -> Finding:
    guideline = get_guideline(guideline_id)
    if guideline is None:
        raise ValueError(f"Unknown guideline ID: {guideline_id}")
    return Finding(
        id=f"finding_{uuid4().hex[:8]}",
        run_id=run_id,
        category=category or normalize_category(guideline.category),
        title=title,
        description=description,
        severity=severity or normalize_severity(guideline.default_severity),
        confidence=confidence,
        page_url=page_url,
        observed_behavior=observed_behavior,
        reproduction_steps=reproduction_steps,
        evidence_ids=evidence_ids,
        verification_status=verification_status,
        **_guideline_fields(guideline_id),
    )


SYSTEM_PROMPT = """
You are an AI UX QA reviewer. Analyze only the provided browser evidence.
Return JSON only. Do not speculate and return an empty findings array when evidence is insufficient.
Every finding must cite one guideline_id from the provided guideline catalog and evidence_ids that support it.
All AI-generated findings are hypotheses, not confirmed compliance failures.
""".strip()


def deterministic_findings(run_id: str, evidence: dict[str, Any]) -> list[Finding]:
    checks = evidence.get("guidelineChecks") or {}
    page_url = evidence.get("finalUrl") or evidence.get("targetUrl") or ""
    findings: list[Finding] = []
    unlabeled_controls = checks.get("unlabeledFormControls") or []
    if unlabeled_controls:
        findings.append(
            _finding(
                run_id,
                page_url,
                "WCAG22-3.3.2",
                "Form controls are missing accessible labels",
                f"{len(unlabeled_controls)} visible form control(s) have no associated label or accessible name.",
                "The browser inspection found visible inputs without an accessible name.",
                ["Open the target page", "Inspect the listed form controls with a screen reader"],
                ["evidence.json"],
                0.98,
                "confirmed",
            )
        )

    viewport = checks.get("viewport") or {}
    if viewport.get("hasHorizontalOverflow"):
        findings.append(
            _finding(
                run_id,
                page_url,
                "WCAG22-1.4.10",
                "Page has horizontal overflow at a mobile viewport",
                "Content extends beyond the mobile viewport and requires horizontal scrolling.",
                "The document scroll width exceeded the viewport width at 390 CSS pixels.",
                ["Open the target page at a 390px-wide viewport", "Check for horizontal scrolling"],
                ["evidence.json", "mobile.png"],
                0.98,
                "confirmed",
            )
        )

    small_targets = checks.get("smallTargets") or []
    if small_targets:
        findings.append(
            _finding(
                run_id,
                page_url,
                "WCAG22-2.5.8",
                "Potentially undersized pointer targets detected",
                f"{len(small_targets)} non-inline interactive control(s) are smaller than 24 by 24 CSS pixels.",
                "The browser measured controls below the WCAG target-size threshold; "
                "spacing and equivalent-control exceptions need review.",
                ["Open the target page", "Measure the listed interactive controls and nearby target spacing"],
                ["evidence.json"],
                0.72,
                "needs_human_review",
            )
        )

    keyboard = checks.get("keyboard") or {}
    if keyboard.get("focusLostToDocument"):
        findings.append(
            _finding(
                run_id,
                page_url,
                "WCAG22-2.1.1",
                "Keyboard tab navigation loses focus to the document",
                "Tab navigation did not reach a visible interactive element during the sampled keyboard flow.",
                "The browser recorded focus on the document body while stepping through keyboard focus.",
                [
                    "Open the target page",
                    "Navigate with Tab",
                    "Verify focus reaches visible controls in a logical order",
                ],
                ["evidence.json"],
                0.85,
                "likely",
            )
        )
    return findings


def fallback_findings(run_id: str, evidence: dict[str, Any]) -> list[Finding]:
    findings = deterministic_findings(run_id, evidence)
    page_url = evidence.get("finalUrl") or evidence.get("targetUrl") or ""
    if evidence.get("failedRequests"):
        findings.append(
            _finding(
                run_id,
                page_url,
                "REACT-UI-ASYNC-001",
                "Failed network requests detected",
                "One or more network requests failed during the QA run.",
                "The browser recorded request failures.",
                ["Open the target page", "Repeat the captured flow", "Inspect the network panel for failed requests"],
                ["evidence.json"],
                0.9,
                "confirmed",
                category="network",
            )
        )
    if evidence.get("errorResponses"):
        findings.append(
            _finding(
                run_id,
                page_url,
                "REACT-UI-ASYNC-001",
                "HTTP error responses were returned",
                "The application returned one or more HTTP responses with status 400 or higher.",
                "Error responses were captured while executing the page flow.",
                [
                    "Open the target page",
                    "Repeat the captured flow",
                    "Inspect network responses with error status codes",
                ],
                ["evidence.json"],
                0.88,
                "confirmed",
            )
        )
    violations = evidence.get("axeViolations") or []
    if violations:
        first = violations[0]
        findings.append(
            _finding(
                run_id,
                page_url,
                "WCAG22-1.3.1",
                f"Accessibility issue: {first.get('id', 'axe violation')}",
                first.get("description") or "axe-core found an accessibility issue.",
                first.get("help") or "Accessibility rules were violated on the page.",
                [
                    "Open the target page",
                    "Run the accessibility scan",
                    "Review the reported violation and affected elements",
                ],
                ["evidence.json", "page.png"],
                0.95,
                "confirmed",
            )
        )
    severe_console = [message for message in evidence.get("consoleMessages") or [] if "error" in message.lower()]
    if severe_console:
        findings.append(
            _finding(
                run_id,
                page_url,
                "REACT-UI-ASYNC-001",
                "Console errors detected during execution",
                "The browser console recorded one or more error messages.",
                "Console error output was captured while the page was loading or interacting.",
                ["Open the target page", "Repeat the captured flow", "Inspect browser console output"],
                ["evidence.json"],
                0.85,
                "confirmed",
            )
        )
    return findings


def generate_with_openai(run_id: str, evidence: dict[str, Any]) -> list[Finding]:
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    if not api_key or OpenAI is None:
        return fallback_findings(run_id, evidence)
    client = OpenAI(api_key=api_key)
    prompt = json.dumps(
        {"run_id": run_id, "guidelines": [vars(rule) for rule in GUIDELINES.values()], "evidence": evidence}
    )
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
                        "Return {'findings': []}. Each finding needs guideline_id, title, description, severity, "
                        "confidence, page_url, observed_behavior, reproduction_steps, and evidence_ids.\n\n" + prompt
                    ),
                },
            ],
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        findings = deterministic_findings(run_id, evidence)
        page_url = evidence.get("finalUrl") or evidence.get("targetUrl") or ""
        for item in payload.get("findings", []):
            guideline_id = item.get("guideline_id")
            if guideline_id not in GUIDELINES:
                continue
            findings.append(
                _finding(
                    run_id,
                    item.get("page_url") or page_url,
                    guideline_id,
                    item.get("title", "Untitled finding"),
                    item.get("description", ""),
                    item.get("observed_behavior", ""),
                    item.get("reproduction_steps", []),
                    item.get("evidence_ids", ["evidence.json"]),
                    min(max(float(item.get("confidence", 0.5)), 0), 1),
                    "needs_human_review",
                    severity=normalize_severity(item.get("severity", "medium")),
                    category=normalize_category(item.get("category", get_guideline(guideline_id).category)),
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
