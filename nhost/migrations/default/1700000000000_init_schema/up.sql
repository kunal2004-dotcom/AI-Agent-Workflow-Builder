-- ============================================================
-- AI Agent Workflow Builder — Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS TABLE
-- ============================================================
CREATE TABLE public.organizations (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  quota_limit  INTEGER     NOT NULL DEFAULT 100,
  quota_used   INTEGER     NOT NULL DEFAULT 0,
  quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.organizations IS 'Top-level tenant — each org has independent workflows and quota';

-- ============================================================
-- ORG MEMBERS TABLE
-- Links nhost auth.users to organizations with a role
-- ============================================================
CREATE TABLE public.org_members (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);
COMMENT ON TABLE public.org_members IS 'Maps auth users to orgs with a role — the join table for Layer 1 permissions';
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);

-- ============================================================
-- WORKFLOWS TABLE
-- ============================================================
CREATE TABLE public.workflows (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.workflows IS 'A named workflow belonging to an org, composed of ordered steps';
CREATE INDEX idx_workflows_org_id ON public.workflows(org_id);

-- ============================================================
-- WORKFLOW STEPS TABLE
-- Each step has a type and JSONB config
-- ============================================================
CREATE TABLE public.workflow_steps (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
    'llm_call',
    'http_request',
    'db_write',
    'notify',
    'conditional_branch',
    'approval_gate'
  )),
  config      JSONB       NOT NULL DEFAULT '{}',
  order_index INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.workflow_steps IS 'Ordered steps within a workflow — type-specific config stored as JSONB';
CREATE INDEX idx_workflow_steps_workflow_id ON public.workflow_steps(workflow_id);

-- ============================================================
-- WORKFLOW TRIGGERS TABLE
-- ============================================================
CREATE TABLE public.workflow_triggers (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN (
    'manual',
    'webhook',
    'scheduled',
    'db_event'
  )),
  config      JSONB       NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.workflow_triggers IS 'How a workflow can be started — manual, webhook, cron, or db event';
CREATE INDEX idx_workflow_triggers_workflow_id ON public.workflow_triggers(workflow_id);

-- ============================================================
-- WORKFLOW RUNS TABLE
-- One row per execution instance
-- ============================================================
CREATE TABLE public.workflow_runs (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id        UUID        NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  status             TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'paused', 'completed', 'failed'
  )),
  trigger_type       TEXT,
  triggered_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  current_step_index INTEGER     NOT NULL DEFAULT 0,
  context            JSONB       NOT NULL DEFAULT '{}',
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.workflow_runs IS 'One run per execution. status=paused means an approval_gate is blocking it.';
CREATE INDEX idx_workflow_runs_workflow_id ON public.workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX idx_workflow_runs_created_at ON public.workflow_runs(created_at);

-- ============================================================
-- STEP RUNS TABLE
-- One row per step per run — live-updated as execution proceeds
-- ============================================================
CREATE TABLE public.step_runs (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID        NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_id         UUID        NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'paused', 'completed', 'failed', 'skipped'
  )),
  input           JSONB,
  output          JSONB,
  error           TEXT,
  attempt_count   INTEGER     NOT NULL DEFAULT 0,
  approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.step_runs IS 'Execution record per step per run — subscribed to by the frontend for live status';
CREATE INDEX idx_step_runs_workflow_run_id ON public.step_runs(workflow_run_id);
CREATE INDEX idx_step_runs_status ON public.step_runs(status);

-- ============================================================
-- AGGREGATION VIEW — org monthly usage
-- Used for the quota indicator in the frontend
-- ============================================================
CREATE OR REPLACE VIEW public.org_monthly_usage AS
SELECT
  w.org_id,
  COUNT(wr.id)                                                   AS runs_this_month,
  AVG(EXTRACT(EPOCH FROM (wr.completed_at - wr.started_at)))     AS avg_duration_seconds,
  COUNT(CASE WHEN wr.status = 'completed' THEN 1 END)            AS completed_runs,
  COUNT(CASE WHEN wr.status = 'failed' THEN 1 END)               AS failed_runs,
  COUNT(CASE WHEN wr.status = 'paused' THEN 1 END)               AS paused_runs
FROM public.workflow_runs wr
JOIN public.workflows w ON wr.workflow_id = w.id
WHERE wr.created_at >= DATE_TRUNC('month', NOW())
GROUP BY w.org_id;

COMMENT ON VIEW public.org_monthly_usage IS 'Aggregated run stats per org for the current calendar month';

-- ============================================================
-- WATCHED EVENTS TABLE — for DB Event Trigger
-- Insert rows here to trigger workflows that have db_event triggers
-- ============================================================
CREATE TABLE public.watched_events (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.watched_events IS 'Insert a row here to trigger all workflows whose db_event trigger config matches the event_type';

-- ============================================================
-- updated_at TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
