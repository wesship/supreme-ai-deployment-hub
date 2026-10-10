from backend.visual_intelligence.style_library import VisualStyleLibrary


def test_search_finds_product_style() -> None:
    library = VisualStyleLibrary()
    results = library.search("luxury product advertising")

    assert results
    assert results[0].style_id == "commercial-luxury-product"


def test_compile_applies_style_and_constraints() -> None:
    library = VisualStyleLibrary()
    result = library.compile(
        "Create an EARTH ANGEL perfume campaign",
        style_id="commercial-luxury-product",
        constraints=("champagne atmosphere", "centered bottle hero"),
        negative_constraints=("no extra bottles",),
        metadata={"workflow": "brand-forge"},
    )

    assert "EARTH ANGEL perfume campaign" in result.prompt
    assert "premium commercial product photography" in result.prompt
    assert "champagne atmosphere" in result.prompt
    assert result.style_id == "commercial-luxury-product"
    assert result.category == "product"
    assert result.negative_prompt is not None
    assert "no extra bottles" in result.negative_prompt
    assert result.metadata["compiler"] == "d3vonn.visual_intelligence.v1"


def test_compile_without_style_remains_provider_neutral() -> None:
    library = VisualStyleLibrary()
    result = library.compile("Generate a clean icon")

    assert result.prompt == "Generate a clean icon"
    assert result.style_id is None
    assert result.source is None


def test_unknown_style_is_rejected() -> None:
    library = VisualStyleLibrary()

    try:
        library.compile("test", style_id="missing-style")
    except KeyError as exc:
        assert "missing-style" in str(exc)
    else:
        raise AssertionError("expected unknown style to raise KeyError")
