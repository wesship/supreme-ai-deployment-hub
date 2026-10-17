from pathlib import Path

BASE = Path(__file__).resolve().parents[1]


def test_default_mode_is_airgap():
    text = (BASE / "config/pocket-node.env.example").read_text()
    assert "POCKET_MODE=AIRGAP" in text


def test_default_bind_is_loopback():
    text = (BASE / "config/pocket-node.env.example").read_text()
    assert "POCKET_BIND_HOST=127.0.0.1" in text


def test_process_tools_default_off():
    text = (BASE / "config/pocket-node.env.example").read_text()
    assert "POCKET_ALLOW_PROCESS_TOOLS=false" in text


def test_no_example_bridge_token():
    text = (BASE / "config/pocket-node.env.example").read_text()
    assert "D3VONN_BRIDGE_TOKEN=\n" in text


def test_bridge_launcher_fails_closed():
    text = (BASE / "launch/start.sh").read_text()
    assert "BRIDGE endpoint required" in text
    assert "BRIDGE token required" in text


def test_airgap_enforces_loopback():
    text = (BASE / "launch/start.sh").read_text()
    assert "AIRGAP mode requires loopback binding" in text
