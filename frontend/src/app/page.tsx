'use client';
import { useAuthenticationStatus } from '@nhost/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

const features = [
  {
    icon: '🤖',
    title: 'Multi-Step AI Agents',
    desc: 'Chain LLM calls, HTTP requests, DB writes, and notifications into sophisticated agent pipelines.',
  },
  {
    icon: '⚡',
    title: 'Live Execution Stream',
    desc: 'Watch every step execute in real time via WebSocket subscriptions — no polling, no refresh.',
  },
  {
    icon: '🔒',
    title: 'Approval Gates',
    desc: 'Pause any workflow mid-run for human review. Only authorized roles can unblock execution.',
  },
  {
    icon: '🔀',
    title: 'Conditional Branching',
    desc: "Evaluate the LLM's output with JavaScript expressions and route the workflow dynamically.",
  },
  {
    icon: '🏢',
    title: 'Multi-Org Isolation',
    desc: 'Complete tenant isolation — cross-org data is invisible even by direct ID guessing.',
  },
  {
    icon: '🌐',
    title: 'Four Trigger Types',
    desc: 'Manual, webhook, scheduled cron, or database event — multiple ways to start any workflow.',
  },
];

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-icon">⚡</div>
          <span>FlowMind</span>
        </div>
        <div className="navbar-actions">
          <Link href="/auth/login" className="btn btn-ghost btn-sm">Sign In</Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1 }}>
        <div className="hero">
          <div className="hero-badge">
            <span>⚡</span>
            <span>Built on nhost + Hasura + Groq</span>
          </div>

          <h1>Build AI Agent Workflows<br />That Actually Work</h1>

          <p style={{ fontSize: '1.2rem', color: '#9ca3af', maxWidth: 560, textAlign: 'center', lineHeight: 1.7 }}>
            Chain LLMs, APIs, and databases with approval gates and live monitoring.
            Multi-tenant, permission-layered, and built for teams.
          </p>

          <div className="hero-actions">
            <Link href="/auth/register" className="btn btn-primary btn-lg">
              Start Building — It&apos;s Free
            </Link>
            <Link href="/auth/login" className="btn btn-secondary btn-lg">
              Sign In
            </Link>
          </div>

          {/* Live demo pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 999,
            fontSize: '0.8125rem',
            color: '#34d399',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            Live WebSocket subscriptions · Real Groq LLM · Real-time approval gates
          </div>

          {/* Features Grid */}
          <div className="features-grid">
            {features.map((feature, idx) => (
              <div key={idx} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{feature.title}</h4>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '1.5rem',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.875rem',
      }}>
        <p>© {new Date().getFullYear()} FlowMind AI — Built with nhost, Hasura, Groq & Next.js</p>
      </footer>
    </div>
  );
}
