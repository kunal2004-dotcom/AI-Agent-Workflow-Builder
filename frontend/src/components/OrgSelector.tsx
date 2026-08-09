'use client';
import React, { useState } from 'react';

interface Org {
  id: string;
  name: string;
  role: string;
}

interface Props {
  orgs: Org[];
  currentOrgId: string | null;
  onSelect: (id: string) => void;
}

export default function OrgSelector({ orgs, currentOrgId, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const currentOrg = orgs.find(o => o.id === currentOrgId) || orgs[0];

  if (!currentOrg) return null;

  return (
    <div className="relative">
      <button 
        className="btn btn-ghost flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium">{currentOrg.name}</span>
        <span className="badge badge-sm">{currentOrg.role}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
          {orgs.map(org => (
            <div 
              key={org.id}
              className={`p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${org.id === currentOrgId ? 'bg-blue-50' : ''}`}
              onClick={() => {
                onSelect(org.id);
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{org.name}</span>
              <span className="badge badge-sm">{org.role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
