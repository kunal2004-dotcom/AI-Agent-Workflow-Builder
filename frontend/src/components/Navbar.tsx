'use client';
import React from 'react';
import Link from 'next/link';
import { nhost } from '@/lib/nhost';
import { useUserData } from '@nhost/react';
import OrgSelector from './OrgSelector';
import QuotaIndicator from './QuotaIndicator';

interface OrgEntry {
  id: string;
  name: string;
  role: string;
  quota_used?: number;
  quota_limit?: number;
  quota_reset_at?: string;
}

interface Props {
  currentOrgId: string | null;
  onOrgChange: (id: string) => void;
  // Accept orgs as flat entries {id, name, role, quota_*}
  orgs: OrgEntry[];
  userRole: string;
}

export default function Navbar({ currentOrgId, onOrgChange, orgs, userRole: _userRole }: Props) {
  const user = useUserData();
  const currentOrg = orgs.find(o => o.id === currentOrgId) || orgs[0];

  const handleSignOut = async () => {
    await nhost.auth.signOut();
    window.location.href = '/';
  };

  return (
    <nav className="navbar">
      {/* Left: Logo + Org Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/dashboard" className="navbar-logo">
          <div className="logo-icon">⚡</div>
          <span>FlowMind</span>
        </Link>

        {orgs.length > 0 && (
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1rem' }}>
            <OrgSelector orgs={orgs} currentOrgId={currentOrgId} onSelect={onOrgChange} />
          </div>
        )}
      </div>

      {/* Right: Quota + User + Sign Out */}
      <div className="navbar-actions">
        {currentOrg && currentOrg.quota_limit != null && (
          <div style={{ display: 'none', '@media (min-width: 768px)': { display: 'block' } } as any}>
            <QuotaIndicator
              quota_used={currentOrg.quota_used || 0}
              quota_limit={currentOrg.quota_limit || 100}
              quota_reset_at={currentOrg.quota_reset_at || ''}
              compact={true}
            />
          </div>
        )}

        {user?.email && (
          <span style={{
            fontSize: '0.8125rem',
            color: '#6b7280',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </span>
        )}

        <button
          id="sign-out-btn"
          className="btn btn-ghost btn-sm"
          onClick={handleSignOut}
          style={{ color: '#9ca3af' }}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
