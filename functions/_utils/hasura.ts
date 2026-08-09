// Shared Hasura admin GraphQL client for nhost functions
// Uses x-hasura-admin-secret to bypass row-level permissions

const HASURA_ENDPOINT =
  process.env.NHOST_GRAPHQL_URL ||
  'http://graphql:8080/v1/graphql';

const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET || '';

export async function hasuraAdmin<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const response = await fetch(HASURA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e: any) => e.message).join('; ');
    throw new Error(`Hasura Error: ${msg}`);
  }

  return json.data as T;
}

// ──────────────────────────────────────────────────────────────
// Common queries / mutations used by multiple functions
// ──────────────────────────────────────────────────────────────

export const GET_WORKFLOW_WITH_STEPS = `
  query GetWorkflowWithSteps($workflow_id: uuid!) {
    workflows_by_pk(id: $workflow_id) {
      id
      org_id
      name
      is_active
      organization {
        id
        name
        quota_limit
        quota_used
        quota_reset_at
      }
      workflow_steps(order_by: { order_index: asc }) {
        id
        type
        config
        order_index
      }
    }
  }
`;

export const GET_ORG_MEMBER = `
  query GetOrgMember($org_id: uuid!, $user_id: uuid!) {
    org_members(
      where: { org_id: { _eq: $org_id }, user_id: { _eq: $user_id } }
      limit: 1
    ) {
      id
      role
      org_id
      user_id
    }
  }
`;

export const CREATE_WORKFLOW_RUN = `
  mutation CreateWorkflowRun(
    $workflow_id: uuid!
    $status: String!
    $trigger_type: String
    $triggered_by: uuid
  ) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflow_id
      status: $status
      trigger_type: $trigger_type
      triggered_by: $triggered_by
      started_at: "now()"
      context: {}
    }) {
      id
    }
  }
`;

export const UPDATE_WORKFLOW_RUN = `
  mutation UpdateWorkflowRun(
    $run_id: uuid!
    $status: String!
    $current_step_index: Int
    $context: jsonb
    $error_message: String
    $completed_at: timestamptz
  ) {
    update_workflow_runs_by_pk(
      pk_columns: { id: $run_id }
      _set: {
        status: $status
        current_step_index: $current_step_index
        context: $context
        error_message: $error_message
        completed_at: $completed_at
      }
    ) {
      id
      status
    }
  }
`;

export const CREATE_STEP_RUN = `
  mutation CreateStepRun(
    $workflow_run_id: uuid!
    $step_id: uuid!
    $status: String!
    $input: jsonb
  ) {
    insert_step_runs_one(object: {
      workflow_run_id: $workflow_run_id
      step_id: $step_id
      status: $status
      input: $input
      started_at: "now()"
    }) {
      id
    }
  }
`;

export const UPDATE_STEP_RUN = `
  mutation UpdateStepRun(
    $step_run_id: uuid!
    $status: String!
    $output: jsonb
    $error: String
    $attempt_count: Int
    $approved_by: uuid
    $approved_at: timestamptz
    $completed_at: timestamptz
  ) {
    update_step_runs_by_pk(
      pk_columns: { id: $step_run_id }
      _set: {
        status: $status
        output: $output
        error: $error
        attempt_count: $attempt_count
        approved_by: $approved_by
        approved_at: $approved_at
        completed_at: $completed_at
      }
    ) {
      id
      status
    }
  }
`;

export const GET_STEP_RUN_WITH_CONTEXT = `
  query GetStepRunWithContext($step_run_id: uuid!) {
    step_runs_by_pk(id: $step_run_id) {
      id
      status
      workflow_run_id
      step_id
      workflow_step {
        type
        config
        order_index
        workflow_id
      }
      workflow_run {
        id
        status
        current_step_index
        context
        workflow_id
        workflow {
          id
          org_id
          organization {
            id
            quota_limit
            quota_used
          }
          workflow_steps(order_by: { order_index: asc }) {
            id
            type
            config
            order_index
          }
        }
      }
    }
  }
`;

export const INCREMENT_QUOTA_USED = `
  mutation IncrementQuotaUsed($org_id: uuid!) {
    update_organizations_by_pk(
      pk_columns: { id: $org_id }
      _inc: { quota_used: 1 }
    ) {
      id
      quota_used
    }
  }
`;
