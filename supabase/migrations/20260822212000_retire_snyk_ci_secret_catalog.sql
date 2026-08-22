-- Retire the repository-managed Snyk CI credential catalog entry.
-- Credential values are never stored here; this only removes stale metadata after
-- the GitHub Actions Snyk integration and secret references are retired.

DELETE FROM public.secret_inventory
WHERE name = 'SNYK_TOKEN'
  AND platform = 'Snyk'
  AND environment = 'ci';
