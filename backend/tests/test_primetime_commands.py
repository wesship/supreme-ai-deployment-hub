from backend.intelligence.commands import normalize_code, parse_command


def test_normalize_code():
    assert normalize_code(" crm_audit ") == "CRM-AUDIT"
    assert normalize_code("human approval") == "HUMAN-APPROVAL"


def test_parse_and_expand_master_code():
    result = parse_command(
        "COMPLIANCE-360 + SMS-SEQUENCE + TABLE: Create a follow-up sequence."
    )
    assert "TCPA-CHECK" in result["expandedCodes"]
    assert result["instruction"] == "Create a follow-up sequence."
    assert result["approvalLevel"] == 3
    assert result["humanApprovalRequired"] is True
    assert result["licensedReviewRequired"] is True
    assert result["outputFormat"] == "TABLE"


def test_alias_and_unknown_code_detection():
    alias_result = parse_command("crm review: inspect records")
    assert alias_result["requestedCodes"] == ["CRM-AUDIT"]
    assert alias_result["unknownCodes"] == []

    unknown_result = parse_command("CRM-ANALYZE + TABLE: inspect")
    assert unknown_result["unknownCodes"] == ["CRM-ANALYZE"]


def test_conflict_detection():
    result = parse_command("TABLE + JSON: format this")
    assert result["conflicts"] == [{"left": "TABLE", "right": "JSON"}]
