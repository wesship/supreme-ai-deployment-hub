import pytest

from backend.app.routers.primetime_release7_observability import (
    SloEvaluationCreate,
    _evaluate_slo,
    _validate_dimensions,
)


@pytest.mark.parametrize(
    ("definition", "measured_value", "expected"),
    [
        ({"comparator": "lte", "target_value": 250, "warning_threshold": 200}, 180, "compliant"),
        ({"comparator": "lte", "target_value": 250, "warning_threshold": 200}, 225, "warning"),
        ({"comparator": "lte", "target_value": 250, "warning_threshold": 200}, 251, "breached"),
        ({"comparator": "gte", "target_value": 99, "warning_threshold": 99.5}, 99.7, "compliant"),
        ({"comparator": "gte", "target_value": 99, "warning_threshold": 99.5}, 99.2, "warning"),
        ({"comparator": "gte", "target_value": 99, "warning_threshold": 99.5}, 98.9, "breached"),
    ],
)
def test_evaluate_slo_applies_comparator_and_warning_band(definition, measured_value, expected):
    assert _evaluate_slo(definition, measured_value) == expected


def test_dimensions_normalize_safe_keys_and_values():
    assert _validate_dimensions({"Runtime_Mode": " staging ", "region": "us-west"}) == {
        "runtime_mode": "staging",
        "region": "us-west",
    }


@pytest.mark.parametrize(
    "dimensions",
    [
        {"authorization": "redacted"},
        {"unsafe-key": "value"},
        {"region": ""},
        {"region": "x" * 129},
        {f"dimension_{index}": "value" for index in range(13)},
    ],
)
def test_dimensions_reject_unsafe_or_high_cardinality_data(dimensions):
    with pytest.raises(ValueError):
        _validate_dimensions(dimensions)


def test_evaluation_payload_omits_optional_timestamp_for_database_default():
    payload = SloEvaluationCreate(
        workspace_id="11111111-1111-1111-1111-111111111111",
        slo_definition_id="22222222-2222-2222-2222-222222222222",
        measured_value=99.9,
    ).model_dump(mode="json", exclude_none=True)

    assert "evaluated_at" not in payload
    assert "source_signal_id" not in payload
