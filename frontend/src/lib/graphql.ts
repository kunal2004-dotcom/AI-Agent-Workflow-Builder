// Global GraphQL queries, mutations, and subscriptions

import { gql } from '@apollo/client';

// ──────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────

export const GET_MY_ORGS = gql`
  query GetMyOrgs {
    org_members {
      role
      organization {
        id
        name
        quota_limit
        quota_used
        quota_reset_at
        created_at
      }
    }
  }
`;

export const GET_ORG_WORKFLOWS = gql`
  query GetOrgWorkflows($org_id: uuid!) {
    workflows(
      where: { org_id: { _eq: $org_id } }
      order_by: { created_at: desc }
    ) {
      id
      name
      description
      is_active
      created_at
      updated_at
      workflow_steps(order_by: { order_index: asc }) {
        id
        type
        config
        order_index
      }
      workflow_triggers {
        id
        type
        config
        is_active
      }
      workflow_runs(order_by: { created_at: desc }, limit: 1) {
        id
        status
        trigger_type
        created_at
        completed_at
      }
    }
  }
`;

export const GET_WORKFLOW_DETAIL = gql`
  query GetWorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description
      is_active
      org_id
      created_at
      updated_at
      workflow_steps(order_by: { order_index: asc }) {
        id
        type
        config
        order_index
      }
      workflow_triggers {
        id
        type
        config
        is_active
      }
      workflow_runs(order_by: { created_at: desc }, limit: 10) {
        id
        status
        trigger_type
        triggered_by
        started_at
        completed_at
        created_at
      }
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrgMembers($org_id: uuid!) {
    org_members(where: { org_id: { _eq: $org_id } }) {
      id
      role
      created_at
      user {
        id
        displayName
        email
      }
    }
  }
`;

export const GET_WORKFLOW_RUN = gql`
  query GetWorkflowRun($run_id: uuid!) {
    workflow_runs_by_pk(id: $run_id) {
      id
      status
      trigger_type
      triggered_by
      started_at
      completed_at
      current_step_index
      error_message
      workflow {
        id
        name
        org_id
        workflow_steps(order_by: { order_index: asc }) {
          id
          type
          config
          order_index
        }
      }
      step_runs(order_by: { created_at: asc }) {
        id
        status
        input
        output
        error
        attempt_count
        approved_by
        approved_at
        started_at
        completed_at
        workflow_step {
          id
          type
          config
          order_index
        }
      }
    }
  }
`;

// ──────────────────────────────────────────────────────────────
// MUTATIONS
// ──────────────────────────────────────────────────────────────

export const CREATE_ORGANIZATION = gql`
  mutation CreateOrganization($name: String!) {
    createOrganization(input: { name: $name }) {
      org_id
      name
    }
  }
`;

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow(
    $org_id: uuid!
    $name: String!
    $description: String
    $is_active: Boolean!
  ) {
    insert_workflows_one(
      object: {
        org_id: $org_id
        name: $name
        description: $description
        is_active: $is_active
      }
    ) {
      id
      name
    }
  }
`;

export const UPDATE_WORKFLOW = gql`
  mutation UpdateWorkflow(
    $id: uuid!
    $name: String!
    $description: String
    $is_active: Boolean!
  ) {
    update_workflows_by_pk(
      pk_columns: { id: $id }
      _set: {
        name: $name
        description: $description
        is_active: $is_active
      }
    ) {
      id
      name
    }
  }
`;

export const DELETE_WORKFLOW_STEPS = gql`
  mutation DeleteWorkflowSteps($workflow_id: uuid!) {
    delete_workflow_steps(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
  }
`;

export const INSERT_WORKFLOW_STEPS = gql`
  mutation InsertWorkflowSteps($steps: [workflow_steps_insert_input!]!) {
    insert_workflow_steps(objects: $steps) {
      affected_rows
      returning { id type order_index }
    }
  }
`;

export const DELETE_WORKFLOW_TRIGGERS = gql`
  mutation DeleteWorkflowTriggers($workflow_id: uuid!) {
    delete_workflow_triggers(where: { workflow_id: { _eq: $workflow_id } }) {
      affected_rows
    }
  }
`;

export const INSERT_WORKFLOW_TRIGGERS = gql`
  mutation InsertWorkflowTriggers($triggers: [workflow_triggers_insert_input!]!) {
    insert_workflow_triggers(objects: $triggers) {
      affected_rows
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflow_id: uuid!, $input_data: jsonb) {
    triggerWorkflowRun(input: { workflow_id: $workflow_id, input_data: $input_data }) {
      run_id
      status
      message
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: uuid!) {
    approveStep(input: { step_run_id: $step_run_id }) {
      success
      message
      run_status
    }
  }
`;

export const ADD_ORG_MEMBER = gql`
  mutation AddOrgMember($org_id: uuid!, $user_id: uuid!, $role: String!) {
    insert_org_members_one(object: { org_id: $org_id, user_id: $user_id, role: $role }) {
      id
      role
    }
  }
`;

export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($id: uuid!, $role: String!) {
    update_org_members_by_pk(pk_columns: { id: $id }, _set: { role: $role }) {
      id
      role
    }
  }
`;

export const REMOVE_ORG_MEMBER = gql`
  mutation RemoveOrgMember($id: uuid!) {
    delete_org_members_by_pk(id: $id) {
      id
    }
  }
`;

// ──────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ──────────────────────────────────────────────────────────────

export const SUBSCRIBE_STEP_RUNS = gql`
  subscription StepRunProgress($workflow_run_id: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflow_run_id } }
      order_by: { created_at: asc }
    ) {
      id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      created_at
      workflow_step {
        id
        type
        config
        order_index
      }
    }
  }
`;

export const SUBSCRIBE_WORKFLOW_RUN = gql`
  subscription WorkflowRunStatus($run_id: uuid!) {
    workflow_runs_by_pk(id: $run_id) {
      id
      status
      current_step_index
      error_message
      started_at
      completed_at
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;
