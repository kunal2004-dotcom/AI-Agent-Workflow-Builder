// Inbound webhook handler — external systems POST here to trigger a workflow run
// POST /v1/functions/webhook-trigger
//
// The caller must provide a valid webhook_secret (stored in workflow_triggers config)
// This acts as authentication for external callers instead of JWT

import type { Request, Response } from 'express';
import {
  hasuraAdmin,
  GET_WORKFLOW_WITH_STEPS,
  CREATE_WORKFLOW_RUN,
  UPDATE_WORKFLOW_RUN,
} from './_utils/hasura';
import { executeWorkflowFromStep } from './_utils/executor';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { workflow_id, data = {}, webhook_secret } = req.body;

    if (!workflow_id) {
      return res.status(400).json({ message: 'workflow_id is required' });
    }

    // ── Fetch workflow ─────────────────────────────────────────
    const workflowData = await hasuraAdmin<any>(GET_WORKFLOW_WITH_STEPS, { workflow_id });
    const workflow = workflowData?.workflows_by_pk;

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    if (!workflow.is_active) {
      return res.status(400).json({ message: 'Workflow is not active' });
    }

    // ── Validate webhook secret ────────────────────────────────
    const webhookTrigger = await hasuraAdmin<any>(`
      query GetWebhookTrigger($workflow_id: uuid!) {
        workflow_triggers(where: {
          workflow_id: { _eq: $workflow_id },
          type: { _eq: "webhook" },
          is_active: { _eq: true }
        }, limit: 1) {
          id
          config
        }
      }
    `, { workflow_id });

    const trigger = webhookTrigger?.workflow_triggers?.[0];

    if (!trigger) {
      return res.status(404).json({ message: 'No active webhook trigger found for this workflow' });
    }

    // Verify webhook secret if configured
    const configuredSecret = trigger.config?.webhook_secret;
    if (configuredSecret && configuredSecret !== webhook_secret) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    // ── Quota check ────────────────────────────────────────────
    const org = workflow.organization;
    if (org.quota_used >= org.quota_limit) {
      return res.status(429).json({ message: 'Quota exhausted for this organization' });
    }

    const steps = workflow.workflow_steps;
    if (!steps || steps.length === 0) {
      return res.status(400).json({ message: 'Workflow has no steps' });
    }

    // ── Create workflow run ────────────────────────────────────
    const createRunData = await hasuraAdmin<any>(`
      mutation CreateWebhookRun($workflow_id: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflow_id
          status: "running"
          trigger_type: "webhook"
          started_at: "now()"
          context: {}
        }) { id }
      }
    `, { workflow_id });

    const runId: string = createRunData.insert_workflow_runs_one.id;

    // Respond immediately so the caller doesn't time out
    res.status(202).json({
      run_id: runId,
      status: 'running',
      message: 'Workflow run started via webhook',
    });

    // ── Execute asynchronously ─────────────────────────────────
    // Since we already responded, this runs in the background
    executeWorkflowFromStep({
      workflowRunId: runId,
      steps,
      startIndex: 0,
      context: { webhookData: data },
      orgId: workflow.org_id,
    }).catch(async (err) => {
      console.error('[webhook-trigger] Execution error:', err);
      await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
        run_id: runId,
        status: 'failed',
        current_step_index: 0,
        context: {},
        error_message: err?.message,
        completed_at: new Date().toISOString(),
      });
    });
  } catch (err: any) {
    console.error('[webhook-trigger] Error:', err);
    // If response was not already sent
    if (!res.headersSent) {
      return res.status(500).json({ message: err?.message || 'Internal server error' });
    }
  }
}
