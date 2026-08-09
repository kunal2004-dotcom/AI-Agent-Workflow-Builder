'use client';
import { useState } from 'react';
import { nhost } from '@/lib/nhost';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await nhost.auth.signIn({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.12), transparent)',
      padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: '0.875rem',
            boxShadow: '0 8px 32px rgba(79,70,229,0.4)',
          }}>⚡</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>FlowMind</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.375rem' }}>Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>⚠️ {error}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@company.com"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              id="sign-in-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', height: 42 }}
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#9ca3af' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" style={{ color: '#818cf8', fontWeight: 500, textDecoration: 'none' }}>
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
