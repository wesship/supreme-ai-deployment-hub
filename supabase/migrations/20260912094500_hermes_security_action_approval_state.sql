-- Align the legacy Hermes security-action audit table with the governed approval service.
-- This migration is additive and intentionally quarantines legacy pending rows so no
-- historical action becomes executable merely because the new approval API exists.

ALTER TABLE public.hermes_security_actions
    ADD COLUMN IF NOT EXISTS agent_name TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'legacy_pending',
    ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve the legacy audit context in the structured field expected by current code.
UPDATE public.hermes_security_actions
SET details = COALESCE(parameters, '{}'::jsonb)
WHERE details = '{}'::jsonb
  AND parameters IS NOT NULL;

-- Existing result values were not created through the approval state machine. Map only
-- completed terminal states and leave legacy pending values non-executable.
UPDATE public.hermes_security_actions
SET status = CASE result
    WHEN 'success' THEN 'executed'
    WHEN 'failure' THEN 'execution_failed'
    WHEN 'skipped' THEN 'dry_run'
    ELSE 'legacy_pending'
END
WHERE status = 'legacy_pending';

ALTER TABLE public.hermes_security_actions
    DROP CONSTRAINT IF EXISTS hermes_security_actions_status_check;

ALTER TABLE public.hermes_security_actions
    ADD CONSTRAINT hermes_security_actions_status_check
    CHECK (status IN (
        'legacy_pending',
        'pending_approval',
        'approved',
        'rejected',
        'executing',
        'executed',
        'dry_run',
        'execution_failed',
        'completed'
    ));

CREATE INDEX IF NOT EXISTS hermes_security_actions_status_created_at_idx
    ON public.hermes_security_actions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS hermes_security_actions_approval_queue_idx
    ON public.hermes_security_actions (action_type, created_at DESC)
    WHERE status IN ('pending_approval', 'approved', 'executing');

COMMENT ON COLUMN public.hermes_security_actions.status IS
    'Governed lifecycle. Legacy rows are non-executable; only explicit pending_approval rows may be approved.';
COMMENT ON COLUMN public.hermes_security_actions.details IS
    'Structured immutable-style audit context for agent action, approval, and execution events.';
