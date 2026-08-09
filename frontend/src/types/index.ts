// Shared TypeScript types for the frontend

export type StepType =
  | 'llm_call'
  | 'http_request'
  | 'db_write'
  | 'notify'
  | 'conditional_branch'
  | 'approval_gate';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'skipped';

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'db_event';

export type OrgRole = 'owner' | 'editor' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  quota_limit: number;
  quota_used: number;
  quota_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  organization?: Organization;
  user?: {
    id: string;
    displayName?: string;
    email?: string;
  };
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  type: StepType;
  config: Record<string, any>;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowTrigger {
  id: string;
  workflow_id: string;
  type: TriggerType;
  config: Record<string, any>;
  is_active: boolean;
  created_at?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: RunStatus;
  trigger_type?: string;
  triggered_by?: string;
  started_at?: string;
  completed_at?: string;
  current_step_index: number;
  error_message?: string;
  created_at: string;
}

export interface StepRun {
  id: string;
  workflow_run_id: string;
  step_id: string;
  status: StepStatus;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  attempt_count: number;
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  workflow_step?: WorkflowStep;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  workflow_steps: WorkflowStep[];
  workflow_triggers: WorkflowTrigger[];
  workflow_runs: WorkflowRun[];
  organization?: Organization;
}

// ── Helper functions ────────────────────────────────────────

export function getStepTypeLabel(type: StepType): string {
  const labels: Record<StepType, string> = {
    llm_call: 'LLM Call',
    http_request: 'HTTP Request',
    db_write: 'DB Write',
    notify: 'Notify',
    conditional_branch: 'Condition',
    approval_gate: 'Approval',
  };
  return labels[type] || type;
}

export function getStepTypeClass(type: StepType): string {
  const classes: Record<StepType, string> = {
    llm_call: 'step-llm',
    http_request: 'step-http',
    db_write: 'step-db',
    notify: 'step-notify',
    conditional_branch: 'step-branch',
    approval_gate: 'step-approval',
  };
  return classes[type] || '';
}

export function getStepTypeEmoji(type: StepType): string {
  const emojis: Record<StepType, string> = {
    llm_call: '🤖',
    http_request: '🌐',
    db_write: '💾',
    notify: '🔔',
    conditional_branch: '🔀',
    approval_gate: '🔒',
  };
  return emojis[type] || '⚙️';
}

export function getTriggerTypeLabel(type: TriggerType): string {
  const labels: Record<TriggerType, string> = {
    manual: 'Manual',
    webhook: 'Webhook',
    scheduled: 'Scheduled',
    db_event: 'DB Event',
  };
  return labels[type] || type;
}

export function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export const SENSITIVE_STEP_TYPES: StepType[] = ['db_write', 'notify'];

export function canAddStepType(type: StepType, role: OrgRole): boolean {
  if (role === 'owner') return true;
  if (role === 'editor') return !SENSITIVE_STEP_TYPES.includes(type);
  return false;
}

export const NHOST_FUNCTIONS_URL =
  'https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1';

export const WEBHOOK_TRIGGER_URL = `${NHOST_FUNCTIONS_URL}/webhook-trigger`;
