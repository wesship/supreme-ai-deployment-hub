-- Keep private AI Film render artifacts owner-scoped.
-- Object paths use the owning ai_film_projects.id as the first folder segment.

DROP POLICY IF EXISTS "owners read ai film renders" ON storage.objects;
CREATE POLICY "owners read ai film renders"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-film-renders'
  AND EXISTS (
    SELECT 1
    FROM public.ai_film_projects AS p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "owners upload ai film renders" ON storage.objects;
CREATE POLICY "owners upload ai film renders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-film-renders'
  AND EXISTS (
    SELECT 1
    FROM public.ai_film_projects AS p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "owners update ai film renders" ON storage.objects;
CREATE POLICY "owners update ai film renders"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai-film-renders'
  AND EXISTS (
    SELECT 1
    FROM public.ai_film_projects AS p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'ai-film-renders'
  AND EXISTS (
    SELECT 1
    FROM public.ai_film_projects AS p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "owners delete ai film renders" ON storage.objects;
CREATE POLICY "owners delete ai film renders"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-film-renders'
  AND EXISTS (
    SELECT 1
    FROM public.ai_film_projects AS p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.owner_id = (SELECT auth.uid())
  )
);
