# TwelveLabs v1.3 asset upload note

`POST /v1.3/assets` expects `multipart/form-data` for both `method=direct` and `method=url`.

For MovieFlow renders, normalize OSS snapshot URLs to the raw `.mp4` path before creating the asset. Google Drive share URLs are not direct media URLs and must be materialized/downloaded before using the direct-file upload path.
