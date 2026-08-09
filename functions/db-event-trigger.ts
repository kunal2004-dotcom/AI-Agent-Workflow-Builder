// DB Event Trigger handler — called by Hasura Event Trigger on watched_events table INSERT
// POST /v1/functions/db-event-trigger
//
// When a row is inserted into public.watched_events, Hasura fires this function.
// It finds all active workflows with db_event triggers matching the event_type
// and starts a run for each.

import type { Request, Response } from 'express';
import { hasuraAdmin, GET_WORKFLOW_WITH_STEPS, UPDATE_WORKFLOW_RUN } from './_utils/hasura';
import { executeWorkflowFromStep } from './_utils/executor';

interface HasuraEventTriggerPayload {
  id: string;
  table: { schema: string; name: string };
  trigger: { name: string };
  event: {
    op: 'INSERT' | 'UPDATE' | 'DELETE';
    data: {
      old: Record<string, any> | null;
      new: Record<string, any> | null;
    };
    session_variables?: Record<string, string>;
  };
  delivery_info: { current_retry: number; max_retries: number };
  created_at: string;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify the request comes from Hasura using the webhook secret
  const webhookSecret = req.headers['x-hasura-event-secret'] || req.headers['x-webhook-secret'];
  if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = req.body as HasuraEventTriggerPayload;
    const newRow = payload.event?.data?.new;

    if (!newRow) {
      return res.status(200).json({ message: 'No new row data, ignoring' });
    }

    const eventType = newRow.event_type || 'unknown';
    const eventPayload = newRow.payload || {};

    // Find all active workflows with db_event triggers matching this event_type
    const matchingTriggers = await hasuraAdmin<any>(`
      query GetDbEventWorkflows($event_type: String!) {
        workflow_triggers(where: {
          type: { _eq: "db_event" },
          is_active: { _eq: true },
          config: { _contains: { event_type: $event_type } },
          workflow: { is_active: { _eq: true } }
        }) {
          id
          config
          workflow_id
          workflow {
            id
            org_id
            name
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
    `, { event_type: eventType });

    const triggers = matchingTriggers?.workflow_triggers || [];

    // Respond quickly so Hasura doesn't retry
    res.status(200).json({ message: `Processing ${triggers.length} matching workflows`, event_type: eventType });

    // Execute matching workflows in background
    for (const trigger of triggers) {
      const workflow = trigger.workflow;
      if (!workflow?.is_active) continue;

      const org = workflow.organization;
      if (org.quota_used >= org.quota_limit) {
        console.log(`[db-event-trigger] Skipping ${trigger.workflow_id} — quota exhausted`);
        continue;
      }

      try {
        const createRunData = await hasuraAdmin<any>(`
          mutation CreateDbEventRun($workflow_id: uuid!) {
            insert_workflow_runs_one(object: {
              workflow_id: $workflow_id
              status: "running"
              trigger_type: "db_event"
              started_at: "now()"
              context: {}
            }) { id }
          }
        `, { workflow_id: trigger.workflow_id });

        const runId: string = createRunData.insert_workflow_runs_one.id;

        executeWorkflowFromStep({
          workflowRunId: runId,
          steps: workflow.workflow_steps,
          startIndex: 0,
          context: { eventType, eventPayload, dbEventTrigger: true },
          orgId: workflow.org_id,
        }).catch(async (err) => {
          await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
            run_id: runId,
            status: 'failed',
            current_step_index: 0,
            context: { eventType, eventPayload },
            error_message: err?.message,
            completed_at: new Date().toISOString(),
          });
        });
      } catch (err: any) {
        console.error(`[db-event-trigger] Failed to start run for workflow ${trigger.workflow_id}:`, err);
      }
    }
  } catch (err: any) {
    console.error('[db-event-trigger] Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: err?.message || 'Internal server error' });
    }
  }
}
