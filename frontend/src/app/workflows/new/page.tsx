'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_MY_ORGS } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import WorkflowBuilder from '@/components/WorkflowBuilder';

export default function NewWorkflowPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get('org_id');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(queryOrgId);

  const { data: orgData } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (orgData?.organization_members?.length > 0 && !currentOrgId) {
      setCurrentOrgId(localStorage.getItem('flowmind_org_id') || orgData.organization_members[0].organization.id);
    }
  }, [orgData, currentOrgId]);

  if (authLoading || !orgData) return <div className="h-screen flex items-center justify-center"><span className="spinner w-12 h-12"></span></div>;

  const orgs = orgData?.organization_members || [];
  const currentOrg = orgs.find((o: any) => o.organization.id === currentOrgId);

  if (!currentOrg) return null;
  
  if (currentOrg.role === 'viewer') {
    router.push('/dashboard');
    return null;
  }

  const handleSaved = (id: string) => {
    router.push(`/workflows/${id}?org_id=${currentOrgId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar currentOrgId={currentOrgId} onOrgChange={(id) => { setCurrentOrgId(id); localStorage.setItem('flowmind_org_id', id); }} orgs={orgs} userRole={currentOrg.role} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentOrgId={currentOrgId!} userRole={currentOrg.role} />
        
        <main className="flex-1 overflow-y-auto p-8 page-content">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Create New Workflow</h1>
            <p className="text-gray-600">Configure your AI agent's steps and triggers.</p>
          </div>
          
          <WorkflowBuilder orgId={currentOrgId!} userRole={currentOrg.role} onSaved={handleSaved} />
        </main>
      </div>
    </div>
  );
}
