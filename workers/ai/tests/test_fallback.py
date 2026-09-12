import main


def test_fallback_empty_evidence_yields_nothing():
    assert main.fallback_findings("run_1", {}) == []


def test_fallback_flags_network_and_axe_and_console():
    evidence = {
        "finalUrl": "https://example.com/",
        "failedRequests": ["GET https://x/api :: net::ERR"],
        "errorResponses": [{"url": "https://x/api", "status": 500, "method": "GET"}],
        "axeViolations": [{"id": "color-contrast", "help": "Fix contrast"}],
        "consoleMessages": ["[error] boom"],
    }
    categories = {f.category for f in main.fallback_findings("run_1", evidence)}
    assert {"network", "functional", "accessibility"} <= categories
