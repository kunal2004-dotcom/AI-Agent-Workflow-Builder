'use client';
import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { APPROVE_STEP } from '@/lib/graphql';

interface Props {
  stepRun: {
    id: string;
    status: string;
    output?: any;
    approved_by?: string;
    approved_at?: string;
  };
  userRole: string;
  onApproved: () => void;
}

export default function ApprovalGateCard({ stepRun, userRole, onApproved }: Props) {
  const [approveStep, { loading }] = useMutation(APPROVE_STEP);
  const [error, setError] = useState<string | null>(null);
  const [localApproved, setLocalApproved] = useState(false);

  const handleApprove = async () => {
    try {
      setError(null);
      const result = await approveStep({ variables: { step_run_id: stepRun.id } });
      if (result.data?.approveStep?.success) {
        setLocalApproved(true);
        onApproved();
      } else {
        setError(result.data?.approveStep?.message || 'Approval failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve step');
    }
  };

  const isApproved = localApproved || (stepRun.approved_at != null);

  if (isApproved) {
    return (
      <div style={{
        padding: '0.875rem 1rem',
        background: 'rgba(16,185,129,0.1)',
        border: '1px solid rgba(16,185,129,0.3)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>✅</span>
        <div>
          <div style={{ color: '#34d399', fontWeight: 600, fontSize: '0.9rem' }}>Step Approved</div>
          {stepRun.approved_at && (
            <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
              {new Date(stepRun.approved_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(139,92,246,0.1))',
      border: '1px solid rgba(236,72,153,0.35)',
      borderRadius: 12,
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔒</span>
          <span style={{ color: '#f472b6', fontWeight: 700, fontSize: '1rem' }}>
            Awaiting Manual Approval
          </span>
        </div>

        {stepRun.output?.message && (
          <p style={{ color: '#d1d5db', fontSize: '0.875rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
            {stepRun.output.message}
          </p>
        )}

        {error && (
          <div className="alert alert-error" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        {['owner', 'editor'].includes(userRole) ? (
          <button
            id="approve-step-btn"
            className="btn btn-success"
            onClick={handleApprove}
            disabled={loading}
            style={{ minWidth: 160 }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Approving...
              </>
            ) : (
              '✅ Approve & Continue'
            )}
          </button>
        ) : (
          <div style={{
            padding: '0.5rem 1rem',
            background: 'rgba(107,114,128,0.1)',
            border: '1px solid rgba(107,114,128,0.2)',
            borderRadius: 8,
            color: '#9ca3af',
            fontSize: '0.8125rem',
            fontStyle: 'italic',
          }}>
            Only owners/editors can approve
          </div>
        )}
      </div>
    </div>
  );
}
