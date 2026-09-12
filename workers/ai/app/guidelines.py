from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Guideline:
    id: str
    source: str
    source_url: str
    title: str
    category: str
    default_severity: str


GUIDELINES: dict[str, Guideline] = {
    "WCAG22-1.3.1": Guideline(
        id="WCAG22-1.3.1",
        source="WCAG 2.2",
        source_url="https://www.w3.org/TR/WCAG22/#info-and-relationships",
        title="Info and Relationships",
        category="accessibility",
        default_severity="high",
    ),
    "WCAG22-1.4.10": Guideline(
        id="WCAG22-1.4.10",
        source="WCAG 2.2",
        source_url="https://www.w3.org/TR/WCAG22/#reflow",
        title="Reflow",
        category="accessibility",
        default_severity="high",
    ),
    "WCAG22-2.1.1": Guideline(
        id="WCAG22-2.1.1",
        source="WCAG 2.2",
        source_url="https://www.w3.org/TR/WCAG22/#keyboard",
        title="Keyboard",
        category="accessibility",
        default_severity="high",
    ),
    "WCAG22-2.5.8": Guideline(
        id="WCAG22-2.5.8",
        source="WCAG 2.2",
        source_url="https://www.w3.org/TR/WCAG22/#target-size-minimum",
        title="Target Size (Minimum)",
        category="accessibility",
        default_severity="medium",
    ),
    "WCAG22-3.3.2": Guideline(
        id="WCAG22-3.3.2",
        source="WCAG 2.2",
        source_url="https://www.w3.org/TR/WCAG22/#labels-or-instructions",
        title="Labels or Instructions",
        category="accessibility",
        default_severity="high",
    ),
    "ARIA-APG-ROLE-PROMISE": Guideline(
        id="ARIA-APG-ROLE-PROMISE",
        source="WAI-ARIA Authoring Practices",
        source_url="https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/",
        title="A role is a promise",
        category="accessibility",
        default_severity="medium",
    ),
    "REACT-UI-ASYNC-001": Guideline(
        id="REACT-UI-ASYNC-001",
        source="React UI Component Completion Checklist",
        source_url="https://github.com/realmaitreal/guidelines/blob/main/react-ui-component-completion-checklist.md",
        title="Error and asynchronous states are actionable",
        category="functional",
        default_severity="medium",
    ),
}


def get_guideline(guideline_id: str | None) -> Guideline | None:
    return GUIDELINES.get(guideline_id or "")
