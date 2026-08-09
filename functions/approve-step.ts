// Hasura Action handler: approveStep
// POST /v1/functions/approve-step
//
// LAYER 2 code-level check:
//   The approver's role is verified IN CODE, not by a DB permission alone.
//   This is required because approval is a mid-execution decision.
//
// Flow:
//   1. Fetch step_run + workflow context
//   2. Check approver is owner/editor in the SAME org (cross-org protection)
//   3. Verify step is in 'paused' state
//   4. Mark step completed with approved_by/approved_at
//   5. Resume workflow execution from the next step

import type { Request, Response } from 'express';
import {
  hasuraAdmin,
  GET_ORG_MEMBER,
  GET_STEP_RUN_WITH_CONTEXT,
  UPDATE_STEP_RUN,
  UPDATE_WORKFLOW_RUN,
} from './_utils/hasura';
import { executeWorkflowFromStep } from './_utils/executor';
import { HasuraActionPayload } from './_utils/types';

interface ApproveInput {
  step_run_id: string;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const payload = req.body as HasuraActionPayload<ApproveInput>;
    const approverId = payload.session_variables?.['x-hasura-user-id'];
    const { step_run_id } = payload.input;

    if (!approverId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: no session', run_status: null });
    }

    // ── Fetch the step_run with full workflow context ──────────
    const stepData = await hasuraAdmin<any>(GET_STEP_RUN_WITH_CONTEXT, { step_run_id });
    const stepRun = stepData?.step_runs_by_pk;

    if (!stepRun) {
      return res.status(404).json({ success: false, message: 'Step run not found', run_status: null });
    }

    if (stepRun.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: `Step is not awaiting approval (current status: ${stepRun.status})`,
        run_status: stepRun.workflow_run?.status,
      });
    }

    if (stepRun.workflow_step?.type !== 'approval_gate') {
      return res.status(400).json({
        success: false,
        message: 'This step is not an approval_gate step',
        run_status: stepRun.workflow_run?.status,
      });
    }

    const orgId = stepRun.workflow_run?.workflow?.org_id;

    if (!orgId) {
      return res.status(500).json({ success: false, message: 'Could not determine org from step_run', run_status: null });
    }

    // ── LAYER 2: Check approver's role in the SAME org ────────
    // This is the critical code-level gate. Even if a user guesses the step_run_id,
    // they must be owner/editor in the correct org to proceed.
    const memberData = await hasuraAdmin<any>(GET_ORG_MEMBER, {
      org_id: orgId,
      user_id: approverId,
    });
    const member = memberData?.org_members?.[0];

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: you are not a member of the organization that owns this workflow',
        run_status: null,
      });
    }

    if (!['owner', 'editor'].includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: only owners and editors can approve workflow steps',
        run_status: null,
      });
    }

    const workflowRunId = stepRun.workflow_run_id;
    const runContext = stepRun.workflow_run?.context || {};
    const allSteps = stepRun.workflow_run?.workflow?.workflow_steps || [];
    const currentStepIndex = stepRun.workflow_step?.order_index ?? 0;

    // ── Mark the approval_gate step as completed ───────────────
    await hasuraAdmin(UPDATE_STEP_RUN, {
      step_run_id,
      status: 'completed',
      output: {
        approved: true,
        approved_by: approverId,
        approved_at: new Date().toISOString(),
      },
      error: null,
      attempt_count: 1,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // ── Resume run from the next step after approval_gate ──────
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= allSteps.length) {
      // No more steps — workflow is done
      await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
        run_id: workflowRunId,
        status: 'completed',
        current_step_index: nextStepIndex,
        context: runContext,
        error_message: null,
        completed_at: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        message: 'Step approved. Workflow completed — this was the last step.',
        run_status: 'completed',
      });
    }

    // Mark the run as running again
    await hasuraAdmin(UPDATE_WORKFLOW_RUN, {
      run_id: workflowRunId,
      status: 'running',
      current_step_index: nextStepIndex,
      context: runContext,
      error_message: null,
      completed_at: null,
    });

    // Continue execution from the step after the approval_gate
    const result = await executeWorkflowFromStep({
      workflowRunId,
      steps: allSteps,
      startIndex: nextStepIndex,
      context: runContext,
      orgId,
    });

    return res.status(200).json({
      success: true,
      message:
        result.finalStatus === 'paused'
          ? 'Approved — run paused again at another approval_gate'
          : result.finalStatus === 'failed'
          ? 'Approved but subsequent steps failed'
          : 'Approved — workflow run completed successfully',
      run_status: result.finalStatus,
    });
  } catch (err: any) {
    console.error('[approve-step] Error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Internal server error', run_status: null });
  }
}
