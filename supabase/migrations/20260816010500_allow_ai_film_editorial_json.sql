-- Allow AI FILMS generated editorial manifests and native OTIO JSON files.
-- Preserve the existing private bucket policy, size limit, and MIME allowlist.

update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then array['application/json']::text[]
  when 'application/json' = any(allowed_mime_types) then allowed_mime_types
  else array_append(allowed_mime_types, 'application/json')
end
where id = 'ai-film-media';
