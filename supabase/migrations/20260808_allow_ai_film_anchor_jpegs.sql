-- Allow AI Films anchor-frame JPEGs in the existing private render bucket.
update storage.buckets
set allowed_mime_types = array['video/mp4','image/jpeg']::text[]
where id = 'ai-film-renders';
