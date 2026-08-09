'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_MY_ORGS, GET_ORG_MEMBERS, UPDATE_MEMBER_ROLE, REMOVE_ORG_MEMBER, ADD_ORG_MEMBER } from '@/lib/graphql';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import QuotaIndicator from '@/components/QuotaIndicator';

export default function OrgSettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuthenticationStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get('org_id');
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(queryOrgId);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('viewer');

  const { data: orgData } = useQuery(GET_MY_ORGS, { skip: !isAuthenticated });
  
  useEffect(() => {
    if (orgData?.org_members?.length > 0 && !currentOrgId) {
      setCurrentOrgId(localStorage.getItem('flowmind_org_id') || orgData.org_members[0].organization.id);
    }
  }, [orgData, currentOrgId]);

  const { data: membersData, refetch } = useQuery(GET_ORG_MEMBERS, { 
    variables: { org_id: currentOrgId },
    skip: !currentOrgId
  });

  const [updateRole] = useMutation(UPDATE_MEMBER_ROLE);
  const [removeMember] = useMutation(REMOVE_ORG_MEMBER);
  const [addMember] = useMutation(ADD_ORG_MEMBER);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !orgData) return <div className="h-screen flex items-center justify-center"><span className="spinner w-12 h-12"></span></div>;

  const orgs = orgData?.org_members || [];
  const currentOrg = orgs.find((o: any) => o.organization.id === currentOrgId);

  if (!currentOrg) return null;

  if (currentOrg.role !== 'owner') {
    router.push('/dashboard');
    return null;
  }

  const members = membersData?.org_members || [];

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateRole({ variables: { org_id: currentOrgId, user_id: userId, role } });
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (userId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      try {
        await removeMember({ variables: { org_id: currentOrgId, user_id: userId } });
        refetch();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMember({ variables: { org_id: currentOrgId, email: newMemberEmail, role: newMemberRole } });
      setNewMemberEmail('');
      refetch();
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Organization Settings</h1>
            <p className="text-gray-600">Manage members and quota for {currentOrg.organization.name}</p>
          </div>
          
          <div className="grid-2 mb-8">
            <div className="card p-6 border rounded-lg bg-white shadow-sm">
              <h3 className="text-lg font-bold mb-4">Organization Profile</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Organization Name</label>
                  <input type="text" className="input w-full" value={currentOrg.organization.name} disabled />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Organization ID</label>
                  <input type="text" className="input w-full font-mono text-sm bg-gray-50" value={currentOrg.organization.id} disabled />
                </div>
              </div>
            </div>
            
            <QuotaIndicator 
              quota_used={currentOrg.organization.quota_used} 
              quota_limit={currentOrg.organization.quota_limit} 
              quota_reset_at={currentOrg.organization.quota_reset_at} 
            />
          </div>

          <div className="card p-6 border rounded-lg bg-white shadow-sm mb-8">
            <h3 className="text-lg font-bold mb-4">Team Members</h3>
            
            <form onSubmit={handleAddMember} className="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
              <input type="email" className="input flex-1" placeholder="Email address" required value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} />
              <select className="select w-32" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
              <button type="submit" className="btn btn-primary">Add Member</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm border-b">
                  <tr>
                    <th className="p-4 font-medium">User</th>
                    <th className="p-4 font-medium">Role</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {members.map((m: any) => (
                    <tr key={m.user.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{m.user.displayName || 'Unknown'}</div>
                        <div className="text-gray-500 text-xs">{m.user.email}</div>
                      </td>
                      <td className="p-4">
                        {m.user.id === currentOrg.user.id ? (
                          <span className="badge badge-owner">Owner (You)</span>
                        ) : (
                          <select 
                            className="select select-sm" 
                            value={m.role} 
                            onChange={(e) => handleUpdateRole(m.user.id, e.target.value)}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="owner">Owner</option>
                          </select>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {m.user.id !== currentOrg.user.id && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleRemove(m.user.id)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
