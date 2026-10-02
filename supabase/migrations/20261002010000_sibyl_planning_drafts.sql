-- Dedicated inbox: no triggers/RPCs/foreign keys into executable Hermes tasks.
CREATE TABLE public.hermes_sibyl_planning_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_ref text NOT NULL CHECK (actor_ref ~ '^[0-9a-f]{24}$'),
  idempotency_key uuid NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  summary text NOT NULL CHECK (length(summary) BETWEEN 1 AND 4000),
  synthetic boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'astral-sibyl-echo' CHECK (source = 'astral-sibyl-echo'),
  status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  execution_allowed boolean NOT NULL DEFAULT false CHECK (execution_allowed = false),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_ref, idempotency_key)
);
ALTER TABLE public.hermes_sibyl_planning_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_sibyl_planning_drafts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.hermes_sibyl_planning_drafts FROM service_role;
GRANT SELECT, INSERT ON public.hermes_sibyl_planning_drafts TO service_role;
-- Browser users have no policies and no privileges. Only scoped backend ingress
-- inserts; there is deliberately no approval/execute endpoint in this contract.
