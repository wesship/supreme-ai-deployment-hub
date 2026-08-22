-- Retire the repository-managed Snyk CI credential catalog entry while
-- preserving auditable metadata. Credential values are never stored here.

UPDATE public.secret_inventory
SET status = 'retired'
WHERE name = 'SNYK_TOKEN'
  AND platform = 'Snyk'
  AND environment = 'ci'
  AND status IS DISTINCT FROM 'retired';
