// Core workflow execution engine
// Shared between trigger-workflow-run.ts and approve-step.ts

import { hasuraAdmin, CREATE_STEP_RUN, UPDATE_STEP_RUN, UPDATE_WORKFLOW_RUN, INCREMENT_QUOTA_USED } from './hasura';
import { callGroqLLM } from './llm';
import { WorkflowStep } from './types';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ──────────────────────────────────────────────────────────────
// Evaluate a conditional_branch condition against context
// ──────────────────────────────────────────────────────────────
function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  try {
    // Safe evaluation using Function constructor with context variables
    const contextStr = Object.entries(context)
      .map(([k, v]) => `const ${k.replace(/-/g, '_')} = ${JSON.stringify(v)};`)
      .join('\n');
    const fn = new Function(`
      ${contextStr}
      const lastOutput = ${JSON.stringify(context.lastOutput ?? null)};
      return !!(${condition});
    `);
    return fn();
  } catch (err) {
    console.warn('Condition evaluation error:', err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Execute a single step with retry logic
// ──────────────────────────────────────────────────────────────
async function executeStep(
  step: WorkflowStep,
  context: Record<string, any>,
  workflowRunId: string,
  orgId: string
): Promise<{ output: any; shouldPause: boolean; shouldSkipRest: boolean }> {
  const { type, config } = step;

  switch (type) {
    // ── LLM Call via Groq ──────────────────────────────────────
    case 'llm_call': {
      const result = await callGroqLLM(config, context);
      let parsed = result.content;
      // Try to parse JSON if json_mode was requested
      if (config.json_mode) {
        try {
          parsed = JSON.parse(result.content);
        } catch {
          parsed = result.content;
        }
      }
      return { output: { text: result.content, parsed, usage: result.usage }, shouldPause: false, shouldSkipRest: false };
    }

    // ── HTTP Request ───────────────────────────────────────────
    case 'http_request': {
      const { url, method = 'GET', headers = {}, body: reqBody } = config;
      const interpolatedUrl = url.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => context[k] ?? '');

      const fetchOpts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
      };

      if (reqBody && method !== 'GET') {
        const interpolatedBody = JSON.stringify(reqBody).replace(
          /"\{\{(\w+)\}\}"/g,
          (_: string, k: string) => JSON.stringify(context[k] ?? null)
        );
        fetchOpts.body = interpolatedBody;
      }

      const resp = await fetch(interpolatedUrl, fetchOpts);
      const contentType = resp.headers.get('content-type') || '';
      const respBody = contentType.includes('json') ? await resp.json() : await resp.text();

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${JSON.stringify(respBody)}`);
      }

      return { output: { status: resp.status, body: respBody }, shouldPause: false, shouldSkipRest: false };
    }

    // ── DB Write ───────────────────────────────────────────────
    case 'db_write': {
      const { mutation, variables = {} } = config;
      // Interpolate context variables into the variables object
      const interpolatedVars = JSON.parse(
        JSON.stringify(variables).replace(
          /"?\{\{(\w+)\}\}"?/g,
          (_: string, k: string) => JSON.stringify(context[k] ?? null)
        )
      );
      const result = await hasuraAdmin(mutation, interpolatedVars);
      return { output: { result }, shouldPause: false, shouldSkipRest: false };
    }

    // ── Notify (Slack/webhook) ─────────────────────────────────
    case 'notify': {
      const { webhook_url, message = 'Workflow notification', channel } = config;
      const interpolatedMsg = message.replace(
        /\{\{(\w+)\}\}/g,
        (_: string, k: string) => String(context[k] ?? '')
      );

      if (webhook_url) {
        const payload: any = { text: interpolatedMsg };
        if (channel) payload.channel = channel;

        const resp = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const respText = await resp.text();
        return { output: { sent: true, message: interpolatedMsg, response: respText }, shouldPause: false, shouldSkipRest: false };
      } else {
        // No webhook URL configured — log and continue
        console.log('[notify step] No webhook_url configured. Message:', interpolatedMsg);
        return { output: { sent: false, message: interpolatedMsg, note: 'No webhook_url in config' }, shouldPause: false, shouldSkipRest: false };
      }
    }

    // ── Conditional Branch ─────────────────────────────────────
    case 'conditional_branch': {
      const { condition, false_path = 'continue' } = config;
      const result = evaluateCondition(condition || 'true', context);

      return {
        output: { condition_result: result, condition, false_path },
        shouldPause: false,
        // If condition is false and false_path is 'stop', skip remaining steps
        shouldSkipRest: !result && false_path === 'stop',
      };
    }

    // ── Approval Gate ──────────────────────────────────────────
    case 'approval_gate': {
      const { message = 'Manual approval required to continue' } = config;
      return {
        output: { message, requires_approval: true },
        shouldPause: true,
        shouldSkipRest: false,
      };
    }

    default:
      throw new Error(`Unknown step type: ${type}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Main workflow executor — runs steps from startIndex onwards
// Called by trigger-workflow-run and approve-step (on resume)
// ──────────────────────────────────────────────────────────────
export async function executeWorkflowFromStep(params: {
  workflowRunId: string;
  steps: WorkflowStep[];
  startIndex: number;
  context: Record<string, any>;
  orgId: string;
}): Promise<{ finalStatus: 'completed' | 'paused' | 'failed'; pausedStepRunId?: string }> {
  const { workflowRunId, steps, startIndex, orgId } = params;
  let context = { ...params.context };

  for (let i = startIndex; i < steps.length; i++) {
    const step = steps[i];

    // Create step_run record
    const { insert_step_runs_one } = await hasuraAdmin<any>(CREATE_STEP_RUN, {
      workflow_run_id: workflowRunId,
      step_id: step.id,
      status: 'running',
      input: { context_snapshot: context },
    });
    const stepRunId: string = insert_step_runs_one.id;

    // Update run to show current step index
    await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
      run_id: workflowRunId,
      status: 'running',
      current_step_index: i,
      context,
      error_message: null,
      completed_at: null,
    });

    // Execute with retry for network-based steps
    const retryableTypes = ['llm_call', 'http_request'];
    const isRetryable = retryableTypes.includes(step.type);
    let lastError: string | null = null;
    let output: any = null;
    let shouldPause = false;
    let shouldSkipRest = false;
    let attemptCount = 0;

    for (let attempt = 0; attempt < (isRetryable ? MAX_RETRIES : 1); attempt++) {
      attemptCount = attempt + 1;
      try {
        const result = await executeStep(step, context, workflowRunId, orgId);
        output = result.output;
        shouldPause = result.shouldPause;
        shouldSkipRest = result.shouldSkipRest;
        lastError = null;
        break; // Success — exit retry loop
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.error(`Step ${step.type} attempt ${attempt + 1} failed:`, lastError);
        if (attempt < MAX_RETRIES - 1 && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        }
      }
    }

    // ── Approval gate hit — pause run ──────────────────────────
    if (shouldPause) {
      await hasuraAdmin(UPDATE_STEP_RUN, {
        step_run_id: stepRunId,
        status: 'paused',
        output,
        error: null,
        attempt_count: attemptCount,
        approved_by: null,
        approved_at: null,
        completed_at: null,
      });

      await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
        run_id: workflowRunId,
        status: 'paused',
        current_step_index: i,
        context,
        error_message: null,
        completed_at: null,
      });

      return { finalStatus: 'paused', pausedStepRunId: stepRunId };
    }

    // ── Step failed after all retries ──────────────────────────
    if (lastError !== null) {
      await hasuraAdmin(UPDATE_STEP_RUN, {
        step_run_id: stepRunId,
        status: 'failed',
        output: null,
        error: lastError,
        attempt_count: attemptCount,
        approved_by: null,
        approved_at: null,
        completed_at: new Date().toISOString(),
      });

      await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
        run_id: workflowRunId,
        status: 'failed',
        current_step_index: i,
        context,
        error_message: `Step ${step.type} failed: ${lastError}`,
        completed_at: new Date().toISOString(),
      });

      return { finalStatus: 'failed' };
    }

    // ── Step completed ─────────────────────────────────────────
    await hasuraAdmin(UPDATE_STEP_RUN, {
      step_run_id: stepRunId,
      status: 'completed',
      output,
      error: null,
      attempt_count: attemptCount,
      approved_by: null,
      approved_at: null,
      completed_at: new Date().toISOString(),
    });

    // Accumulate output into context for next steps
    context[step.id] = output;
    context.lastOutput = output;
    context[`step_${i}`] = output;

    // ── Skip remaining steps if conditional_branch says so ─────
    if (shouldSkipRest) {
      // Mark remaining steps as skipped
      for (let j = i + 1; j < steps.length; j++) {
        const { insert_step_runs_one: skipped } = await hasuraAdmin<any>(CREATE_STEP_RUN, {
          workflow_run_id: workflowRunId,
          step_id: steps[j].id,
          status: 'skipped',
          input: null,
        });
        await hasuraAdmin(UPDATE_STEP_RUN, {
          step_run_id: skipped.id,
          status: 'skipped',
          output: { reason: 'conditional_branch evaluated to false with false_path=stop' },
          error: null,
          attempt_count: 0,
          approved_by: null,
          approved_at: null,
          completed_at: new Date().toISOString(),
        });
      }
      break;
    }
  }

  // ── All steps done — mark run completed ───────────────────────
  await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
    run_id: workflowRunId,
    status: 'completed',
    current_step_index: steps.length,
    context,
    error_message: null,
    completed_at: new Date().toISOString(),
  });

  // Increment org quota on completion
  await hasuraAdmin(INCREMENT_QUOTA_USED, { org_id: orgId });

  return { finalStatus: 'completed' };
}
