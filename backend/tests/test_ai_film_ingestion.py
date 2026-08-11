import asyncio
from pathlib import Path

from backend.ai_films.ingestion import (
    TwelveLabsIngestionRunner,
    load_manifest,
    media_content_type,
    normalize_asset_type,
    normalize_movieflow_media_url,
)


MANIFEST = (
    Path(__file__).resolve().parents[1]
    / "ai_films"
    / "manifests"
    / "sovereign_signal_batch_001.json"
)


def test_movieflow_snapshot_url_normalizes_to_raw_mp4():
    url = (
        "https://oss1.movieflow.ai/portrait/1762710808_merged_video_78b8ff35.mp4"
        "?x-oss-process=video/snapshot,t_0,f_jpg,w_0,h_0,m_fast"
    )
    assert normalize_movieflow_media_url(url) == (
        "https://oss1.movieflow.ai/portrait/1762710808_merged_video_78b8ff35.mp4"
    )


def test_movieflow_snapshot_url_preserves_signed_media_parameters():
    url = (
        "https://oss1.movieflow.ai/portrait/render.mp4"
        "?Expires=1770000000&OSSAccessKeyId=test-key"
        "&Signature=signed%2Bvalue"
        "&x-oss-process=video/snapshot,t_0,f_jpg"
    )
    assert normalize_movieflow_media_url(url) == (
        "https://oss1.movieflow.ai/portrait/render.mp4"
        "?Expires=1770000000&OSSAccessKeyId=test-key&Signature=signed%2Bvalue"
    )


def test_sovereign_signal_manifest_is_complete_and_deduplicated():
    manifest = load_manifest(MANIFEST)
    assets = manifest["assets"]
    keys = {(asset["source_type"], asset["source_id"]) for asset in assets}

    assert manifest["batch_id"] == "sovereign-signal-batch-001"
    assert manifest["asset_count"] == 38
    assert manifest["drive_asset_count"] == 23
    assert manifest["movieflow_asset_count"] == 15
    assert len(assets) == 38
    assert len(keys) == 38
    assert sum(asset["source_type"] == "google_drive" for asset in assets) == 23
    assert sum(asset["source_type"] == "movieflow" for asset in assets) == 15


def test_drive_share_link_requires_materialization_before_upload():
    manifest = load_manifest(MANIFEST)
    drive_entry = next(
        asset for asset in manifest["assets"] if asset["source_type"] == "google_drive"
    )

    class FakeClient:
        api_key = "test"
        api_base_url = "https://api.twelvelabs.io/v1.3"
        knowledge_store_id = "ks_test"
        _transport = None

    runner = TwelveLabsIngestionRunner(client=FakeClient())
    result = asyncio.run(runner.ingest_entry(drive_entry))

    assert result["status"] == "materialization_required"
    assert result["source_id"] == drive_entry["source_id"]


def test_movieflow_manifest_urls_are_raw_media_urls():
    manifest = load_manifest(MANIFEST)
    movieflow_assets = [
        asset for asset in manifest["assets"] if asset["source_type"] == "movieflow"
    ]

    assert movieflow_assets
    for asset in movieflow_assets:
        assert asset["media_url"].endswith(".mp4")
        assert "x-oss-process" not in asset["media_url"]


def test_provider_outputs_infer_image_or_video_for_jockey():
    assert normalize_asset_type(None, "legend-anchor.webp") == "image"
    assert normalize_asset_type(None, "scene-07.mp4") == "video"
    assert normalize_asset_type("image", "unknown.bin") == "image"
    assert media_content_type("image", "frame.png") == "image/png"
    assert media_content_type("video", "shot.mov") == "video/quicktime"
