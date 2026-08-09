from backend.ai_films.commerce_router import (
    BrandKit,
    CampaignPlanRequest,
    ProductBrief,
    build_campaign_plan,
)


def test_campaign_plan_cross_products_formats_platforms_and_variants():
    request = CampaignPlanRequest(
        product=ProductBrief(
            name="Signal Jacket",
            description="A weatherproof technical jacket built for creators on the move.",
            audience="mobile filmmakers and creators",
            selling_points=["weather protection", "camera-ready fit"],
            offer="Order today",
        ),
        brand=BrandKit(name="D3VONN", voice="premium and direct"),
        formats=["ugc", "money_shot"],
        platforms=["tiktok", "youtube"],
        variants_per_platform=2,
    )

    result = build_campaign_plan(request)

    assert result["status"] == "planned"
    assert result["credit_spend"] is False
    assert result["variant_count"] == 8
    assert len(result["variants"]) == 8
    assert {item["aspect_ratio"] for item in result["variants"]} == {"9:16", "16:9"}
    assert all(item["provider_route"]["provider"] == "pollo" for item in result["variants"])
    assert all(item["jockey_index_after_render"] is True for item in result["variants"])


def test_campaign_plan_rotates_selling_points():
    request = CampaignPlanRequest(
        product=ProductBrief(
            name="Product",
            description="A complete description for a useful product.",
            audience="business owners",
            selling_points=["speed", "quality"],
        ),
        brand=BrandKit(name="Brand"),
        formats=["feature_highlight"],
        platforms=["meta_feed"],
        variants_per_platform=3,
    )

    result = build_campaign_plan(request)
    assert [item["selling_point"] for item in result["variants"]] == ["speed", "quality", "speed"]
