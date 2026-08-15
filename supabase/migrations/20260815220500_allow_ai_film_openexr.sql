-- Enable OpenEXR assets in the private AI FILMS media bucket.
-- Keep the existing bucket ownership/RLS policies and size limit unchanged.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/x-exr',
  'image/exr',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'application/pdf'
]
where id = 'ai-film-media';
