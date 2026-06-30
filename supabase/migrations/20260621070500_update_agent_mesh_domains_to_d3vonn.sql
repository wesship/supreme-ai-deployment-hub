-- Update default agent mesh endpoints for the d3vonn.io canonical domain.
-- Historical migrations are append-only; this migration updates existing seeded rows.

UPDATE public.agents
SET base_url = 'https://coordinator.d3vonn.io'
WHERE name = 'd3vonn-coordinator'
  AND base_url = 'https://coordinator.d3vonn.io';

UPDATE public.agents
SET base_url = 'https://openclaw.d3vonn.io'
WHERE name = 'openclaw-bridge'
  AND base_url = 'https://openclaw.d3vonn.io';
