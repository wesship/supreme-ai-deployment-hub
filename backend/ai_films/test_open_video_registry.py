from backend.ai_films.open_video_registry import get_video_model, route_video


def test_audio_routes_to_ltx():
    assert route_video(audio=True) == "ltx-2.x"


def test_animation_routes_to_wan():
    assert route_video(animation=True) == "wan2.2-ti2v-5b"


def test_image_input_routes_to_wan():
    assert route_video(image_input=True) == "wan2.2-ti2v-5b"


def test_default_routes_to_ltx():
    assert route_video() == "ltx-2.x"


def test_registry_contains_wan_and_ltx():
    assert get_video_model("wan2.2-ti2v-5b").family == "wan2.2"
    assert get_video_model("ltx-2.x").family == "ltx"
