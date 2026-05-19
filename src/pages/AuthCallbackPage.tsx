import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallbackPage({ onDone }: { onDone: () => Promise<void> }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('code')) await supabase.auth.exchangeCodeForSession(window.location.href);
        await onDone();
        setDone(true);
      } catch (e) {
        setError((e as Error).message || 'Auth confirmation failed');
      }
    })();
  }, [onDone]);

  if (done) return <Navigate to="/home" replace />;
  return <div className="app-bg flex min-h-screen items-center justify-center p-6"><div className="card max-w-sm text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><h1 className="text-xl font-extrabold">Confirming account...</h1>{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}</div></div>;
}
