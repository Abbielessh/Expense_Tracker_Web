import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as repo from '../lib/repository';
import { Field } from '../components/FormFields';
import logoIcon from '../utils/Logo.jpg';

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setLoading(true); setMessage('');
    try { await repo.login(email.trim(), password); await onLoggedIn(); }
    catch (e) { setMessage(mapError(e)); }
    finally { setLoading(false); }
  }

  async function resetPassword() {
    if (!email.trim()) return setMessage('Enter your email first.');
    setLoading(true); setMessage('');
    try { await repo.sendPasswordResetEmail(email.trim()); setMessage('Password reset email sent. Check your inbox.'); }
    catch (e) { setMessage(mapError(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white shadow-soft overflow-hidden">
            <img src={logoIcon} alt="Expense Tracker" className="h-[68px] w-[68px] object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#101828]">Welcome Back</h1>
          <p className="mt-1 text-[#667085]">Sign in to your account</p>
        </div>
        <div className="card space-y-4">
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <div>
            <Field label="Password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="mt-2 flex justify-between">
              <button className="text-sm font-bold text-slate-500" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} password</button>
              <button className="text-sm font-bold text-[#00A3FF]" onClick={() => setForgot(!forgot)}>Forgot Password?</button>
            </div>
          </div>
          {forgot && <button className="outline-btn w-full text-[#2563EB]" onClick={resetPassword} disabled={loading}>Send reset email</button>}
          {message && <div className={`rounded-xl p-3 text-sm font-semibold ${message.includes('sent') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message}</div>}
          <button className="primary-btn w-full" disabled={loading} onClick={submit}>{loading ? 'Signing in...' : 'Login'}</button>
          <p className="text-center text-sm text-[#667085]">Don&apos;t have an account? <Link className="font-bold text-[#2563EB]" to="/signup">Create account</Link></p>
        </div>
      </div>
    </div>
  );
}

function mapError(e: unknown) {
  const raw = (e as Error).message?.toLowerCase() || '';
  if (raw.includes('invalid') || raw.includes('credentials')) return 'Invalid email or password. Please try again.';
  if (raw.includes('timeout') || raw.includes('network')) return 'Network timeout. Please check your internet.';
  return (e as Error).message || 'Login failed';
}
