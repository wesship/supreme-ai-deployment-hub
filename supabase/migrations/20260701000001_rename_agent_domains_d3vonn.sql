-- ==============================================================================
-- Migration: 20260701000001_rename_agent_domains_d3vonn.sql
-- Description: Renames agent coordinator from devonn.ai to d3vonn.io domain
--              and updates agent name to d3vonn-coordinator.
-- This is an append-only migration (does not modify prior migration files).
-- ==============================================================================

-- Rename coordinator agent
UPDATE public.agents
SET name = 'd3vonn-coordinator',
    base_url = 'https://coordinator.d3vonn.io'
WHERE name = 'devonn-coordinator'
  AND base_url = 'https://coordinator.devonn.ai';

-- Update openclaw bridge domain
UPDATE public.agents
SET base_url = 'https://openclaw.d3vonn.io'
WHERE name = 'openclaw-bridge'
  AND base_url = 'https://openclaw.devonn.ai';
