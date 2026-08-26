import pytest

from backend.ai_films.symphony_adapter import SymphonyRequest
from backend.ai_films.symphony_transport import default_symphony_transport


def test_default_transport_never_submits_external_requests():
    transport = default_symphony_transport()
    request = SymphonyRequest(mode="text_to_video", prompt="test")

    with pytest.raises(RuntimeError, match="transport disabled"):
        transport.submit(request)


def test_default_transport_never_polls_external_requests():
    transport = default_symphony_transport()

    with pytest.raises(RuntimeError, match="transport disabled"):
        transport.get_status("job-test")
