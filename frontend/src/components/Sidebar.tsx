'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  currentOrgId: string;
  userRole: string;
}

export default function Sidebar({ currentOrgId, userRole }: Props) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href: '/workflows', label: 'Workflows', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  if (userRole === 'owner') {
    links.push({ href: '/org/settings', label: 'Org Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' });
  }

  return (
    <aside className="sidebar w-64 bg-gray-50 border-r h-[calc(100vh-65px)] sticky top-[65px] hidden md:block">
      <nav className="p-4 flex flex-col gap-2">
        {links.map(link => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link 
              key={link.href} 
              href={`${link.href}?org_id=${currentOrgId}`}
              className={`sidebar-nav-item flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-200'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={link.icon}></path>
                {link.label === 'Org Settings' && <circle cx="12" cy="12" r="3" />}
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
