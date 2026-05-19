import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Field } from '../components/FormFields';
import * as repo from '../lib/repository';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  async function signup() {
    setLoading(true); setMessage('');
    try { await repo.signUp(email.trim(), password); setSent(true); tickCooldown(60); }
    catch (e) { setMessage(mapSignupError(e)); }
    finally { setLoading(false); }
  }

  async function resend() {
    setLoading(true); setMessage('');
    try { await repo.resendConfirmationEmail(email.trim()); setMessage('Confirmation email sent again. Check inbox/spam.'); setCooldown(60); tickCooldown(60); }
    catch (e) { setMessage(mapSignupError(e)); }
    finally { setLoading(false); }
  }

  function tickCooldown(start: number) {
    setCooldown(start);
    const id = window.setInterval(() => setCooldown((v) => { if (v <= 1) { clearInterval(id); return 0; } return v - 1; }), 1000);
  }

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        {!sent ? <>
          <div className="mb-7 text-center"><h1 className="text-3xl font-extrabold text-[#101828]">Create Account</h1><p className="mt-1 text-[#667085]">Start tracking your expenses</p></div>
          <div className="card space-y-4">
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-slate-500">Password must be at least 6 characters.</p>
            {message && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</div>}
            <button className="primary-btn w-full" disabled={loading} onClick={signup}>{loading ? 'Creating...' : 'Sign Up'}</button>
            <p className="text-center text-sm text-[#667085]">Already have an account? <Link className="font-bold text-[#2563EB]" to="/login">Login</Link></p>
          </div>
        </> : <div className="card space-y-4 text-center">
          <div className="text-5xl">📧</div>
          <h1 className="text-2xl font-extrabold text-[#101828]">Check your email</h1>
          <p className="text-sm text-[#388E3C]">We sent a confirmation link to:</p>
          <p className="font-bold text-[#1B5E20]">{email}</p>
          <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Check Inbox, Spam or Promotions. After confirming, come back to this web app and login.</p>
          {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">{message}</p>}
          <button className="primary-btn w-full" disabled={loading || cooldown > 0} onClick={resend}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend confirmation email'}</button>
          <Link className="outline-btn w-full" to="/login">Back to Login</Link>
        </div>}
      </div>
    </div>
  );
}

function mapSignupError(e: unknown) {
  const raw = (e as Error).message?.toLowerCase() || '';
  if (raw.includes('already')) return 'This email is already registered. Please login.';
  if (raw.includes('invalid email')) return 'Please enter a valid email address.';
  if (raw.includes('password')) return 'Password must be at least 6 characters.';
  if (raw.includes('rate') || raw.includes('429')) return 'Email limit reached. Please wait and try again.';
  return (e as Error).message || 'Signup failed';
}
