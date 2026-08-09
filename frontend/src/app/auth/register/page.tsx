'use client';
import { useState } from 'react';
import { nhost } from '@/lib/nhost';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { CREATE_ORGANIZATION } from '@/lib/graphql';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [createOrg] = useMutation(CREATE_ORGANIZATION);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { session, error: signUpError } = await nhost.auth.signUp({ 
        email, 
        password, 
        options: { displayName } 
      });

      if (signUpError) throw signUpError;

      if (session) {
        await createOrg({ variables: { name: orgName } });
        router.push('/dashboard');
      } else {
        setError('Please verify your email to continue.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="card w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">⚡ FlowMind</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        {error && <div className="alert alert-danger mb-6">{error}</div>}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" className="input w-full" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input w-full" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="input w-full" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input type="text" className="input w-full" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
            {loading ? <span className="spinner"></span> : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account? <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
