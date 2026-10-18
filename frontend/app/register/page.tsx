'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { errorMessage } from '@/lib/api';
import { safeNext, useAuth } from '@/lib/auth';
import { Loading, Notice } from '@/components/States';

function RegisterForm() {
  const { user, register } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    try {
      await register(String(form.get('name')), String(form.get('email')), String(form.get('password')));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Create an account</h1>
      <form className="form" onSubmit={onSubmit}>
        {error && <Notice kind="error">{error}</Notice>}
        <label className="field">
          <span className="field__label">Name</span>
          <input className="input" name="name" autoComplete="name" required maxLength={100} />
        </label>
        <label className="field">
          <span className="field__label">Email</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required />
          <span className="field__hint">At least 8 characters.</span>
        </label>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="muted">
        Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RegisterForm />
    </Suspense>
  );
}
