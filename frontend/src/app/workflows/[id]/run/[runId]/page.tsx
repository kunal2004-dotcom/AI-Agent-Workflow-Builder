'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_MY_ORGS } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LiveRunViewer from '@/components/LiveRunViewer';
import Link from 'next/link';
import { formatDuration } from '@/types';

export default function WorkflowRunPage({ params }: { params: { id: string; runId: string } }) {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  const { data: orgData } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !currentOrgId) {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('flowmind_org_id') : null;
      const id = saved || orgData.org_members[0].organization.id;
      setCurrentOrgId(id);
    }
  }, [orgData, currentOrgId]);

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const orgMembers = orgData?.org_members || [];
  const orgsForNav = orgMembers.map((m: any) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
    quota_used: m.organization.quota_used,
    quota_limit: m.organization.quota_limit,
    quota_reset_at: m.organization.quota_reset_at,
  }));
  const currentOrg = orgsForNav.find((o: any) => o.id === currentOrgId) || orgsForNav[0];
  const userRole = currentOrg?.role || 'viewer';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentOrgId={currentOrgId}
        onOrgChange={(id) => { setCurrentOrgId(id); localStorage.setItem('flowmind_org_id', id); }}
        orgs={orgsForNav}
        userRole={userRole}
      />

      <div className="page-layout">
        <Sidebar currentOrgId={currentOrgId || ''} userRole={userRole} />

        <main className="page-content">
          {/* Back button */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Link
              href={`/workflows/${params.id}`}
              className="btn btn-ghost btn-sm"
              style={{ paddingLeft: '0.5rem' }}
            >
              ← Back to Workflow
            </Link>
          </div>

          {/* Page Header */}
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h1 className="page-title">Live Run Execution</h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
                Run ID:{' '}
                <code style={{
                  background: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.75rem',
                }}>
                  {params.runId}
                </code>
              </span>
            </div>
          </div>

          {/* Live Run Viewer with WebSocket subscriptions */}
          <LiveRunViewer runId={params.runId} userRole={userRole} orgId={currentOrgId || ''} />
        </main>
      </div>
    </div>
  );
}
