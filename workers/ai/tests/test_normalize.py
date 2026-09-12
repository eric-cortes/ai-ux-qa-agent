import main


def test_normalize_category_unknown_falls_back_to_ux():
    assert main.normalize_category("visual") == "ux"
    assert main.normalize_category("") == "ux"
    assert main.normalize_category(None) == "ux"


def test_normalize_category_valid_passthrough():
    assert main.normalize_category("Accessibility") == "accessibility"
    assert main.normalize_category("network") == "network"


def test_normalize_severity_unknown_falls_back_to_medium():
    assert main.normalize_severity("urgent") == "medium"
    assert main.normalize_severity(None) == "medium"


def test_normalize_severity_valid_passthrough():
    assert main.normalize_severity("Critical") == "critical"
    assert main.normalize_severity("low") == "low"
