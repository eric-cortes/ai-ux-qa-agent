import main
from guidelines import GUIDELINES


def test_catalog_rules_have_unique_ids_and_https_sources():
    assert GUIDELINES
    assert len(GUIDELINES) == len(set(GUIDELINES))
    assert all(rule.source_url.startswith("https://") for rule in GUIDELINES.values())


def test_deterministic_findings_include_catalog_provenance():
    findings = main.deterministic_findings(
        "run_1",
        {
            "targetUrl": "https://example.com/",
            "guidelineChecks": {
                "unlabeledFormControls": [{"tag": "input"}],
                "smallTargets": [{"tag": "button"}],
                "viewport": {"hasHorizontalOverflow": True},
                "keyboard": {"focusLostToDocument": True},
            },
        },
    )

    assert {finding.guideline_id for finding in findings} == {
        "WCAG22-1.4.10",
        "WCAG22-2.1.1",
        "WCAG22-2.5.8",
        "WCAG22-3.3.2",
    }
    assert all(finding.guideline_source_url for finding in findings)
