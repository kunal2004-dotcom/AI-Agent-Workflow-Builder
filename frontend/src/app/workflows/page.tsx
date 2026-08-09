'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_ORG_WORKFLOWS, TRIGGER_WORKFLOW_RUN, GET_MY_ORGS } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function WorkflowsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get('org_id');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(queryOrgId);

  const { data: orgData } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });
  
  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !currentOrgId) {
      setCurrentOrgId(localStorage.getItem('flowmind_org_id') || orgData.org_members[0].organization.id);
    }
  }, [orgData, currentOrgId]);

  const { data, loading, refetch } = useQuery(GET_ORG_WORKFLOWS, { 
    variables: { org_id: currentOrgId },
    skip: !currentOrgId
  });

  const [triggerRun, { loading: runningId }] = useMutation(TRIGGER_WORKFLOW_RUN);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || loading) return <div className="h-screen flex items-center justify-center"><span className="spinner w-12 h-12"></span></div>;

  const orgs = orgData?.org_members || [];
  const currentOrg = orgs.find((o: any) => o.organization.id === currentOrgId);
  if (!currentOrg) return null;

  const workflows = data?.workflows || [];

  const handleRun = async (id: string) => {
    try {
      const res = await triggerRun({ variables: { workflow_id: id, input_data: {} } });
      const runId = res.data.triggerWorkflowRun.run_id;
      router.push(`/workflows/${id}/run/${runId}?org_id=${currentOrgId}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar currentOrgId={currentOrgId} onOrgChange={(id) => { setCurrentOrgId(id); localStorage.setItem('flowmind_org_id', id); }} orgs={orgs} userRole={currentOrg.role} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentOrgId={currentOrgId!} userRole={currentOrg.role} />
        
        <main className="flex-1 overflow-y-auto p-8 page-content">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Workflows</h1>
            {currentOrg.role !== 'viewer' && (
              <Link href={`/workflows/new?org_id=${currentOrgId}`} className="btn btn-primary">
                + New Workflow
              </Link>
            )}
          </div>

          {workflows.length === 0 ? (
            <div className="empty-state text-center p-12 bg-white rounded-lg border border-dashed">
              <h3 className="text-xl font-medium text-gray-600 mb-2">No workflows found</h3>
              <p className="text-gray-500 mb-6">Create your first AI agent workflow to get started.</p>
              {currentOrg.role !== 'viewer' && (
                <Link href={`/workflows/new?org_id=${currentOrgId}`} className="btn btn-primary">Create Workflow</Link>
              )}
            </div>
          ) : (
            <div className="grid-3">
              {workflows.map((wf: any) => (
                <div key={wf.id} className="card bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <Link href={`/workflows/${wf.id}?org_id=${currentOrgId}`} className="text-lg font-bold text-gray-900 hover:text-blue-600 line-clamp-1">{wf.name}</Link>
                    </div>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10">{wf.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="badge bg-gray-100 text-gray-700">{wf.workflow_steps?.length || 0} steps</span>
                      {wf.workflow_triggers?.map((t: any) => (
                        <span key={t.id} className="badge badge-info">{t.type}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-500">
                      {wf.workflow_runs?.[0] ? `Last run: ${wf.workflow_runs[0].status}` : 'Never run'}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/workflows/${wf.id}?org_id=${currentOrgId}`} className="btn btn-ghost btn-sm">Edit</Link>
                      {currentOrg.role !== 'viewer' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleRun(wf.id)} disabled={runningId}>Run</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
