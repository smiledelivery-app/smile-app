'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, apiBaseUrl, setToken } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type Credentials = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Credentials>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Credentials) => {
    setError('');
    try {
      const session = await api<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(values) });
      setToken(session.token);
      await api('/admin/overview');
      router.replace('/');
    } catch (reason) {
      setToken(null);
      if (reason instanceof TypeError) {
        setError(`The browser could not reach ${apiBaseUrl}. This usually means the API is blocking this admin site's origin. In the API service's Render environment, set ADMIN_ORIGIN=${window.location.origin} (without /login), then redeploy the API. Confirm the admin service has NEXT_PUBLIC_API_URL=${apiBaseUrl} and rebuild it.`);
      } else {
        setError(reason instanceof Error ? reason.message : 'Sign in failed for an unknown reason.');
      }
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-lockup"><Image className="brand-mark-image" src="/smile-logo.png" width={32} height={32} alt="" priority /><span>smile<span className="brand-period">.</span></span></div>
        <div className="login-icon"><ShieldCheck size={21} /></div>
        <p className="eyebrow">ADMINISTRATION</p>
        <h1>Welcome back.</h1>
        <p className="muted-copy">Sign in with an authorized administrator account.</p>
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label htmlFor="email">Work email</label>
          <input id="email" autoComplete="username" type="email" placeholder="you@company.com" {...register('email')} />
          {errors.email && <span className="field-error">{errors.email.message}</span>}
          <label htmlFor="password">Password</label>
          <input id="password" autoComplete="current-password" type="password" placeholder="Your password" {...register('password')} />
          {errors.password && <span className="field-error">{errors.password.message}</span>}
          {error && <div role="alert" className="error-banner">{error}</div>}
          <Button className="button button-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
          </Button>
        </form>
        <p className="security-note"><ShieldCheck size={14} /> Protected by role-based API access</p>
      </section>
      <aside className="login-aside">
        <span className="aside-kicker">OPERATIONS CONSOLE</span>
        <h2>Every delivery.<br />In good hands.</h2>
        <p>One clear view of the people, orders, and operations moving your platform forward.</p>
        <div className="aside-footer"><span className="status-dot" /> Platform operations <span>·</span> Africa/Lagos</div>
      </aside>
    </main>
  );
}
