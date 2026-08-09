'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ORGS, GET_WORKFLOW_DETAIL, TRIGGER_WORKFLOW_RUN } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import WorkflowBuilder from '@/components/WorkflowBuilder';
import Link from 'next/link';

export default function EditWorkflowPage({ params }: { params: { id: string } }) {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get('org_id');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(queryOrgId);

  const { data: orgData } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });
  const { data: wfData, loading: wfLoading } = useQuery(GET_WORKFLOW_DETAIL, { 
    variables: { id: params.id },
    skip: !isAuthenticated
  });

  const [triggerRun, { loading: running }] = useMutation(TRIGGER_WORKFLOW_RUN);
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !currentOrgId) {
      setCurrentOrgId(localStorage.getItem('flowmind_org_id') || orgData.org_members[0].organization.id);
    }
  }, [orgData, currentOrgId]);

  if (authLoading || wfLoading || !orgData) return <div className="h-screen flex items-center justify-center"><span className="spinner w-12 h-12"></span></div>;

  const orgs = orgData?.org_members || [];
  const currentOrg = orgs.find((o: any) => o.organization.id === currentOrgId);
  const workflow = wfData?.workflows_by_pk;

  if (!currentOrg || !workflow) return <div>Not found</div>;

  const handleRun = async () => {
    try {
      const res = await triggerRun({ variables: { workflow_id: workflow.id, input_data: {} } });
      const runId = res.data.triggerWorkflowRun.run_id;
      router.push(`/workflows/${workflow.id}/run/${runId}?org_id=${currentOrgId}`);
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
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Edit Workflow</h1>
              <div className="text-sm text-gray-500">ID: {workflow.id}</div>
            </div>
            {currentOrg.role !== 'viewer' && (
              <button className="btn btn-success btn-lg" onClick={handleRun} disabled={running}>
                {running ? <span className="spinner"></span> : '▶ Run Now'}
              </button>
            )}
          </div>
          
          <WorkflowBuilder workflow={workflow} orgId={currentOrgId!} userRole={currentOrg.role} />

          <div className="mt-12 mb-8">
            <h2 className="text-2xl font-bold mb-4">Run History</h2>
            <div className="card bg-white border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 text-sm border-b">
                  <tr>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Trigger</th>
                    <th className="p-4 font-medium">Started At</th>
                    <th className="p-4 font-medium">Completed At</th>
                    <th className="p-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {workflow.workflow_runs.map((run: any) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <span className={`badge badge-${run.status}`}>{run.status}</span>
                      </td>
                      <td className="p-4">{run.trigger_type}</td>
                      <td className="p-4">{new Date(run.started_at).toLocaleString()}</td>
                      <td className="p-4">{run.completed_at ? new Date(run.completed_at).toLocaleString() : '-'}</td>
                      <td className="p-4 text-right">
                        <Link href={`/workflows/${workflow.id}/run/${run.id}?org_id=${currentOrgId}`} className="text-blue-600 hover:underline">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {workflow.workflow_runs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">No runs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
