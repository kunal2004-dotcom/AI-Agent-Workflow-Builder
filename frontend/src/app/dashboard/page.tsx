'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ORGS, GET_ORG_WORKFLOWS, CREATE_ORGANIZATION } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import QuotaIndicator from '@/components/QuotaIndicator';
import Link from 'next/link';
import { formatDuration } from '@/types';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const { data: orgData, loading: orgLoading } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });
  const { data: workflowData } = useQuery(GET_ORG_WORKFLOWS, {
    variables: { org_id: currentOrgId },
    skip: !currentOrgId,
  });

  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !currentOrgId) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('flowmind_org_id') : null;
      const members = orgData.org_members;
      const found = saved && members.find((m: any) => m.organization.id === saved);
      setCurrentOrgId(found ? saved : members[0].organization.id);
    }
  }, [orgData, currentOrgId]);

  const handleOrgChange = (id: string) => {
    setCurrentOrgId(id);
    if (typeof window !== 'undefined') localStorage.setItem('flowmind_org_id', id);
  };

  if (authLoading || orgLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const orgMembers = orgData?.org_members || [];
  const orgsForNav = orgMembers.map((m: any) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
    quota_used: m.organization.quota_used,
    quota_limit: m.organization.quota_limit,
    quota_reset_at: m.organization.quota_reset_at,
  }));

  const currentMember = orgMembers.find((m: any) => m.organization.id === currentOrgId) || orgMembers[0];
  const currentOrg = currentMember?.organization;
  const userRole = currentMember?.role || 'viewer';

  if (!currentOrg) {
    return <CreateOrgState onCreated={() => window.location.reload()} />;
  }

  const workflows = workflowData?.workflows || [];
  const recentRuns = workflows
    .flatMap((w: any) => w.workflow_runs?.map((r: any) => ({ ...r, workflowName: w.name, workflowId: w.id })) || [])
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const completedRuns = workflows.flatMap((w: any) => w.workflow_runs || []).filter((r: any) => r.status === 'completed').length;
  const totalRuns = workflows.flatMap((w: any) => w.workflow_runs || []).length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentOrgId={currentOrgId} onOrgChange={handleOrgChange} orgs={orgsForNav} userRole={userRole} />

      <div className="page-layout">
        <Sidebar currentOrgId={currentOrgId || ''} userRole={userRole} />

        <main className="page-content">
          {/* Header */}
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">{currentOrg.name} workspace</p>
            </div>
            {userRole !== 'viewer' && (
              <Link href={`/workflows/new?org_id=${currentOrgId}`} className="btn btn-primary">
                + New Workflow
              </Link>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            {/* Quota Card */}
            <div className="card">
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.75rem', fontWeight: 500 }}>
                Monthly Quota
              </p>
              <QuotaIndicator
                quota_used={currentOrg.quota_used}
                quota_limit={currentOrg.quota_limit}
                quota_reset_at={currentOrg.quota_reset_at}
              />
            </div>

            {/* Workflows count */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.375rem', fontWeight: 500 }}>
                Total Workflows
              </p>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f1f3f9' }}>{workflows.length}</div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                {workflows.filter((w: any) => w.is_active).length} active
              </p>
            </div>

            {/* Success rate */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.375rem', fontWeight: 500 }}>
                Success Rate
              </p>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: successRate >= 80 ? '#34d399' : successRate >= 50 ? '#fbbf24' : '#f87171' }}>
                {successRate}%
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                {completedRuns}/{totalRuns} runs completed
              </p>
            </div>
          </div>

          {/* Recent Runs */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>Recent Runs</h3>
              <Link href="/workflows" className="btn btn-ghost btn-sm">
                View Workflows →
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon">▶️</div>
                <h3>No runs yet</h3>
                <p>Trigger a workflow run to see execution history here.</p>
                {userRole !== 'viewer' && (
                  <Link href="/workflows" className="btn btn-primary btn-sm">
                    Go to Workflows
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 100px 100px',
                  gap: '1rem',
                  padding: '0.625rem 0.875rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <span>Workflow</span>
                  <span>Trigger</span>
                  <span>Status</span>
                  <span>Duration</span>
                </div>

                {recentRuns.map((run: any) => (
                  <Link
                    key={run.id}
                    href={`/workflows/${run.workflowId}/run/${run.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 100px 100px',
                      gap: '1rem',
                      padding: '0.875rem',
                      borderTop: '1px solid rgba(255,255,255,0.04)',
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: '#f1f3f9', fontWeight: 500 }}>{run.workflowName}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>{run.trigger_type || '—'}</span>
                    <span className={`badge badge-${run.status}`}>{run.status}</span>
                    <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>{formatDuration(run.started_at, run.completed_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function CreateOrgState({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [createOrg, { loading, error }] = useMutation(CREATE_ORGANIZATION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createOrg({ variables: { name } });
      onCreated();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar currentOrgId={null} onOrgChange={() => {}} orgs={[]} userRole="viewer" />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="card" style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Welcome to FlowMind!</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '2rem' }}>
            To get started building workflows, you need to create your first Organization.
          </p>

          {error && <div className="alert alert-error" style={{ marginBottom: '1rem', textAlign: 'left' }}>⚠️ {error.message}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div className="form-group">
              <label>Organization Name</label>
              <input 
                type="text" 
                className="input" 
                placeholder="e.g. My Workspace" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                minLength={2}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Create Organization'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
