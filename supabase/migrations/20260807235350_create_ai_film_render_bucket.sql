-- Durable private storage for AI Films assembled masters.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-film-renders',
  'ai-film-renders',
  false,
  5368709120,
  array['video/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
