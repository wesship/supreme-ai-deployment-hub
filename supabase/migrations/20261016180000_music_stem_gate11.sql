-- Gate 11 staging schema, reviewed migration only; never deploy automatically.
CREATE TABLE IF NOT EXISTS public.music_stem_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 128),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_path text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('demucs','audio-separator')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id,idempotency_key),
  CHECK (left(source_path, length(owner_id::text) + 1) = owner_id::text || '/')
);
CREATE TABLE IF NOT EXISTS public.music_stem_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.music_stem_jobs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('vocals','drums','bass','other','instrumental')),
  storage_path text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (left(storage_path, length(owner_id::text) + 1) = owner_id::text || '/')
);
ALTER TABLE public.music_stem_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.music_stem_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.music_stem_jobs FROM anon, authenticated;
REVOKE ALL ON public.music_stem_artifacts FROM anon, authenticated;
GRANT SELECT ON public.music_stem_jobs TO authenticated;
GRANT SELECT ON public.music_stem_artifacts TO authenticated;
DROP POLICY IF EXISTS music_jobs_owner_read ON public.music_stem_jobs;
CREATE POLICY music_jobs_owner_read ON public.music_stem_jobs FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS music_artifacts_owner_read ON public.music_stem_artifacts;
CREATE POLICY music_artifacts_owner_read ON public.music_stem_artifacts FOR SELECT TO authenticated
USING (owner_id = (SELECT auth.uid()) AND EXISTS
  (SELECT 1 FROM public.music_stem_jobs j WHERE j.id = job_id AND j.owner_id = (SELECT auth.uid())));
-- Owners may read their records only. All mutations require a reviewed privileged service.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('music-stem-private','music-stem-private',false,104857600,ARRAY['audio/wav','audio/mpeg','audio/flac','audio/ogg','audio/mp4'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS music_stem_owner_read ON storage.objects;
CREATE POLICY music_stem_owner_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='music-stem-private' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
-- Intentionally NO client INSERT, UPDATE, DELETE on storage.objects:
-- authenticated upload must use server-validated signed upload or a scoped service.
