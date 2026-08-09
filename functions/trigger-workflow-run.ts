// Hasura Action handler: triggerWorkflowRun
// POST /v1/functions/trigger-workflow-run
//
// Layer 1 check: caller must be owner/editor in the workflow's org
// Quota check: org.quota_used < org.quota_limit
// Then executes all steps via the shared executor

import type { Request, Response } from 'express';
import {
  hasuraAdmin,
  GET_WORKFLOW_WITH_STEPS,
  GET_ORG_MEMBER,
  CREATE_WORKFLOW_RUN,
  UPDATE_WORKFLOW_RUN,
} from './_utils/hasura';
import { executeWorkflowFromStep } from './_utils/executor';
import { HasuraActionPayload } from './_utils/types';

interface TriggerInput {
  workflow_id: string;
  input_data?: Record<string, any>;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const payload = req.body as HasuraActionPayload<TriggerInput>;
    const userId = payload.session_variables?.['x-hasura-user-id'];
    const { workflow_id, input_data = {} } = payload.input;

    // ── Auth: must have a session ──────────────────────────────
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: no session' });
    }

    // ── Fetch workflow + org ───────────────────────────────────
    const workflowData = await hasuraAdmin<any>(GET_WORKFLOW_WITH_STEPS, { workflow_id });
    const workflow = workflowData?.workflows_by_pk;

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    const org = workflow.organization;

    // ── Layer 1: Verify caller is owner or editor in this org ──
    const memberData = await hasuraAdmin<any>(GET_ORG_MEMBER, {
      org_id: workflow.org_id,
      user_id: userId,
    });
    const member = memberData?.org_members?.[0];

    if (!member) {
      return res.status(403).json({ message: 'Forbidden: you are not a member of this organization' });
    }

    if (!['owner', 'editor'].includes(member.role)) {
      return res.status(403).json({ message: 'Forbidden: viewers cannot trigger workflow runs' });
    }

    // ── Quota check ────────────────────────────────────────────
    if (org.quota_used >= org.quota_limit) {
      return res.status(429).json({
        message: `Quota exhausted: ${org.quota_used}/${org.quota_limit} runs used this period`,
      });
    }

    const steps = workflow.workflow_steps;

    if (!steps || steps.length === 0) {
      return res.status(400).json({ message: 'Workflow has no steps to execute' });
    }

    // ── Create the workflow_run record ─────────────────────────
    const createRunData = await hasuraAdmin<any>(CREATE_WORKFLOW_RUN, {
      workflow_id,
      status: 'running',
      trigger_type: 'manual',
      triggered_by: userId,
    });
    const runId: string = createRunData.insert_workflow_runs_one.id;

    // ── Execute steps (non-blocking response pattern not used ──
    // nhost functions are synchronous — we run inline and stream via DB subscriptions
    const initialContext = { ...input_data, runId };

    try {
      const result = await executeWorkflowFromStep({
        workflowRunId: runId,
        steps,
        startIndex: 0,
        context: initialContext,
        orgId: workflow.org_id,
      });

      return res.status(200).json({
        run_id: runId,
        status: result.finalStatus,
        message:
          result.finalStatus === 'paused'
            ? 'Run paused at approval_gate — awaiting approval'
            : result.finalStatus === 'failed'
            ? 'Run failed — check step_runs for details'
            : 'Run completed successfully',
      });
    } catch (execErr: any) {
      // Mark run as failed if the executor throws unexpectedly
      await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
        run_id: runId,
        status: 'failed',
        current_step_index: 0,
        context: initialContext,
        error_message: execErr?.message || 'Unknown execution error',
        completed_at: new Date().toISOString(),
      });

      return res.status(200).json({
        run_id: runId,
        status: 'failed',
        message: execErr?.message || 'Execution error',
      });
    }
  } catch (err: any) {
    console.error('[trigger-workflow-run] Error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}
