'use client';
import React from 'react';
import { useSubscription, useMutation } from '@apollo/client';
import { SUBSCRIBE_STEP_RUNS, SUBSCRIBE_WORKFLOW_RUN, APPROVE_STEP } from '@/lib/graphql';
import { formatDuration, getStepTypeLabel, getStepTypeEmoji } from '@/types';

interface Props {
  runId: string;
  userRole: string;
  orgId: string;
}

function StepStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending:   '#6b7280',
    running:   '#3b82f6',
    paused:    '#f59e0b',
    completed: '#10b981',
    failed:    '#ef4444',
    skipped:   '#6b7280',
  };
  const color = colors[status] || '#6b7280';
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0,
      boxShadow: status === 'running' ? `0 0 8px ${color}` : 'none',
      animation: status === 'running' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
    }} />
  );
}

function ApprovalBanner({ stepRun, userRole, onApproved }: any) {
  const [approveStep, { loading, error }] = useMutation(APPROVE_STEP);

  const handleApprove = async () => {
    try {
      await approveStep({ variables: { step_run_id: stepRun.id } });
      onApproved();
    } catch (e) {
      console.error('Approve error:', e);
    }
  };

  if (stepRun.approved_at) {
    return (
      <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
        <span style={{ color: '#34d399', fontSize: '0.875rem' }}>
          ✅ Approved {new Date(stepRun.approved_at).toLocaleString()}
        </span>
      </div>
    );
  }

  return (
    <div className="approval-banner" style={{ marginTop: '0.75rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔒</span>
          <strong style={{ color: '#f472b6' }}>Awaiting Manual Approval</strong>
        </div>
        {stepRun.output?.message && (
          <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
            {stepRun.output.message}
          </p>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error.message}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>
        {['owner', 'editor'].includes(userRole) ? (
          <button className="btn btn-success" onClick={handleApprove} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Approving...' : 'Approve & Continue'}
          </button>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: '0.8125rem', fontStyle: 'italic' }}>
            Viewers cannot approve
          </span>
        )}
      </div>
    </div>
  );
}

export default function LiveRunViewer({ runId, userRole }: Props) {
  const { data: runData, loading: runLoading } = useSubscription(SUBSCRIBE_WORKFLOW_RUN, {
    variables: { run_id: runId },
  });
  const { data: stepsData, loading: stepsLoading } = useSubscription(SUBSCRIBE_STEP_RUNS, {
    variables: { workflow_run_id: runId },
  });

  if (runLoading || stepsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '2rem', color: '#9ca3af' }}>
        <span className="spinner" />
        Connecting to live stream...
      </div>
    );
  }

  const run = runData?.workflow_runs_by_pk;
  const stepRuns: any[] = stepsData?.step_runs || [];

  if (!run) return <div className="empty-state"><p>Run not found.</p></div>;

  const runDuration = formatDuration(run.started_at, run.completed_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Run Status Header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Live Execution</h2>
            <span className={`badge badge-${run.status}`}>{run.status}</span>
          </div>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>
            Duration: {runDuration}
            {run.started_at && <> · Started {new Date(run.started_at).toLocaleTimeString()}</>}
          </p>
        </div>
        {run.status === 'running' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
            <span className="spinner" />
            <span style={{ fontSize: '0.875rem' }}>Running...</span>
          </div>
        )}
        {run.status === 'paused' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fbbf24' }}>
            <span>⏸</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Paused — awaiting approval</span>
          </div>
        )}
        {run.error_message && (
          <div className="alert alert-error" style={{ width: '100%' }}>
            ⚠️ {run.error_message}
          </div>
        )}
      </div>

      {/* Step Timeline */}
      {stepRuns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <h3>Preparing steps...</h3>
          <p>Step execution data will appear here shortly.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {stepRuns.map((stepRun, idx) => {
            const step = stepRun.workflow_step;
            const isApprovalGate = step?.type === 'approval_gate';
            const isPaused = stepRun.status === 'paused';
            const isRunning = stepRun.status === 'running';
            const isCompleted = stepRun.status === 'completed';
            const isFailed = stepRun.status === 'failed';

            return (
              <div key={stepRun.id} className={`run-step-card status-${stepRun.status}`}>
                {/* Step Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingTop: '3px' }}>
                    <StepStatusDot status={stepRun.status} />
                    {idx < stepRuns.length - 1 && (
                      <div style={{ width: 2, height: 24, background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>#{idx + 1}</span>
                        <span style={{ fontSize: '1rem' }}>{getStepTypeEmoji(step?.type)}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{getStepTypeLabel(step?.type) || step?.type}</span>
                        {isRunning && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {stepRun.attempt_count > 1 && (
                          <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                            Attempt {stepRun.attempt_count}
                          </span>
                        )}
                        <span className={`badge badge-${stepRun.status}`}>{stepRun.status}</span>
                        {(isCompleted || isFailed) && stepRun.started_at && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {formatDuration(stepRun.started_at, stepRun.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Approval Gate Banner */}
                    {isApprovalGate && isPaused && (
                      <ApprovalBanner
                        stepRun={stepRun}
                        userRole={userRole}
                        onApproved={() => {/* subscription auto-updates */}}
                      />
                    )}

                    {/* Completed Output */}
                    {isCompleted && stepRun.output && !isApprovalGate && (
                      <details style={{ marginTop: '0.75rem' }}>
                        <summary style={{
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          color: '#9ca3af',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          <span>▶ View Output</span>
                        </summary>
                        <div className="json-output" style={{ marginTop: '0.5rem' }}>
                          {typeof stepRun.output === 'object'
                            ? JSON.stringify(stepRun.output, null, 2)
                            : String(stepRun.output)}
                        </div>
                      </details>
                    )}

                    {/* Failed Error */}
                    {isFailed && (
                      <div className="alert alert-error" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
                        ⚠️ {stepRun.error || 'Step failed with an unknown error'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
