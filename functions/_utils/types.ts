// Shared TypeScript types for nhost functions

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

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  type: StepType;
  config: Record<string, any>;
  order_index: number;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: RunStatus;
  current_step_index: number;
  context: Record<string, any>;
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
}

export interface OrgMember {
  user_id: string;
  org_id: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Organization {
  id: string;
  name: string;
  quota_limit: number;
  quota_used: number;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  organization: Organization;
  workflow_steps: WorkflowStep[];
}

// Hasura Action request body shape
export interface HasuraActionPayload<TInput = Record<string, any>> {
  action: { name: string };
  input: TInput;
  session_variables: {
    'x-hasura-user-id': string;
    'x-hasura-default-role': string;
    [key: string]: string;
  };
  request_query?: string;
}
