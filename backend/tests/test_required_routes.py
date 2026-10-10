from unittest.mock import patch

import pytest

from backend.main import app, _verify_required_routes


def test_required_routes_registered():
    _verify_required_routes(app)


def test_missing_nested_voice_router_fails_startup():
    paths = {**app.openapi()["paths"]}
    paths.pop("/api/voice/session")
    with patch.object(app, "openapi", return_value={"paths": paths}):
        with pytest.raises(RuntimeError, match="/api/voice/session"):
            _verify_required_routes(app)
