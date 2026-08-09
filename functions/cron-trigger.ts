// Cron trigger handler — called by Hasura scheduled event every 5 minutes
// POST /v1/functions/cron-trigger
//
// Finds all active workflows with a 'scheduled' trigger type and starts a run
// for each that matches its cron expression and hasn't run in the required interval

import type { Request, Response } from 'express';
import { hasuraAdmin, GET_WORKFLOW_WITH_STEPS, CREATE_WORKFLOW_RUN, UPDATE_WORKFLOW_RUN } from './_utils/hasura';
import { executeWorkflowFromStep } from './_utils/executor';

// Simple cron interval check — returns true if the workflow should run now
// based on its config.interval_minutes setting
function shouldRunNow(config: Record<string, any>, lastRunAt: string | null): boolean {
  const intervalMinutes = config.interval_minutes ?? 60;
  if (!lastRunAt) return true; // Never run before

  const lastRun = new Date(lastRunAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastRun.getTime()) / (1000 * 60);
  return diffMinutes >= intervalMinutes;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify this is called by Hasura (not a random caller)
  const webhookSecret = req.headers['x-webhook-secret'];
  if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Find all active workflows with 'scheduled' triggers
    const scheduledWorkflows = await hasuraAdmin<any>(`
      query GetScheduledWorkflows {
        workflow_triggers(where: {
          type: { _eq: "scheduled" },
          is_active: { _eq: true },
          workflow: { is_active: { _eq: true } }
        }) {
          id
          config
          workflow_id
          workflow {
            id
            org_id
            name
            is_active
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
    `);

    const triggers = scheduledWorkflows?.workflow_triggers || [];
    const results: any[] = [];

    for (const trigger of triggers) {
      const workflow = trigger.workflow;
      if (!workflow || !workflow.is_active) continue;

      const org = workflow.organization;
      if (org.quota_used >= org.quota_limit) {
        results.push({ workflow_id: trigger.workflow_id, skipped: true, reason: 'quota_exhausted' });
        continue;
      }

      // Get last run time for this workflow
      const lastRunData = await hasuraAdmin<any>(`
        query GetLastRun($workflow_id: uuid!) {
          workflow_runs(
            where: { workflow_id: { _eq: $workflow_id } }
            order_by: { created_at: desc }
            limit: 1
          ) { created_at }
        }
      `, { workflow_id: trigger.workflow_id });

      const lastRunAt = lastRunData?.workflow_runs?.[0]?.created_at ?? null;

      if (!shouldRunNow(trigger.config, lastRunAt)) {
        results.push({ workflow_id: trigger.workflow_id, skipped: true, reason: 'not_due_yet' });
        continue;
      }

      // Create and execute the run
      try {
        const createRunData = await hasuraAdmin<any>(`
          mutation CreateScheduledRun($workflow_id: uuid!) {
            insert_workflow_runs_one(object: {
              workflow_id: $workflow_id
              status: "running"
              trigger_type: "scheduled"
              started_at: "now()"
              context: {}
            }) { id }
          }
        `, { workflow_id: trigger.workflow_id });

        const runId: string = createRunData.insert_workflow_runs_one.id;

        // Execute in background (don't await to process all triggers quickly)
        executeWorkflowFromStep({
          workflowRunId: runId,
          steps: workflow.workflow_steps,
          startIndex: 0,
          context: { scheduledRun: true, triggeredAt: new Date().toISOString() },
          orgId: workflow.org_id,
        }).catch(async (err) => {
          await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
            run_id: runId,
            status: 'failed',
            current_step_index: 0,
            context: {},
            error_message: err?.message,
            completed_at: new Date().toISOString(),
          });
        });

        results.push({ workflow_id: trigger.workflow_id, run_id: runId, started: true });
      } catch (err: any) {
        results.push({ workflow_id: trigger.workflow_id, error: err?.message });
      }
    }

    return res.status(200).json({ processed: triggers.length, results });
  } catch (err: any) {
    console.error('[cron-trigger] Error:', err);
    return res.status(500).json({ message: err?.message || 'Internal server error' });
  }
}
