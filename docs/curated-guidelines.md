# Curated QA guideline catalog

The MVP uses a small, checked-in catalog in `workers/ai/app/guidelines.py`. It stores identifiers, source URLs, category, and default severity; it does not copy third-party guideline text.

## Sources

- WCAG 2.2 is the source of accessibility conformance-oriented checks.
- WAI-ARIA Authoring Practices informs ARIA semantics and expected interaction behavior; it is advisory, not a WCAG conformance result.
- The React UI Component Completion Checklist supplies product-quality guidance for asynchronous and error states.

Apple Human Interface Guidelines are deliberately excluded from automated scoring. They are platform-specific and require visual/contextual evaluation that the MVP does not yet perform.

## Finding verification

- `confirmed`: an objective browser measurement or axe result produced the finding.
- `likely`: browser behavior suggests the issue, but a human should verify it.
- `needs_human_review`: an exception, user-flow context, or AI judgment is required.

AI output is accepted only when it names an ID in the catalog and cites captured evidence. Unknown guideline IDs are discarded.
