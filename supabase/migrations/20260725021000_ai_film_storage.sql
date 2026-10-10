-- Private media storage for authenticated AI Film Studio owners.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-film-media',
  'ai-film-media',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/wav','video/mp4','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners read ai film media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ai-film-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners upload ai film media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ai-film-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners update ai film media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'ai-film-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'ai-film-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners delete ai film media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ai-film-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
