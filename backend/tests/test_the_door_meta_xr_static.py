from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
XR = ROOT / "backend" / "the_door" / "xr.py"
ROUTER = ROOT / "backend" / "the_door" / "router.py"


def test_meta_xr_is_provider_neutral_and_fail_closed():
    source = XR.read_text()
    assert 'META = "meta"' in source
    assert 'OPENXR = "openxr"' in source
    assert 'XREAL = "xreal"' in source
    assert 'WEBXR = "webxr"' in source
    assert 'next_step="authorize_in_game"' in source
    assert 'authoritative: bool = False' in source
    assert "No direct LoadLevel/OpenLevel operation is authorized" in source


def test_the_door_exposes_xr_capabilities_and_interaction_boundary():
    source = ROUTER.read_text()
    assert '@router.get("/xr/capabilities")' in source
    assert '@router.post("/xr/interactions"' in source
    assert "Depends(get_current_user_id)" in source
    assert "_meta_xr.normalize(interaction)" in source
