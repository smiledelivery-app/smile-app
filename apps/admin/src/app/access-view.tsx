'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

type Role = 'ADMIN' | 'SUPER_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_ADMIN' | 'CUSTOMER_SUPPORT' | 'VENDOR_MANAGER' | 'RIDER_MANAGER' | 'MARKETING_MANAGER' | 'ANALYST' | 'READ_ONLY_ADMIN';
type AdminAccount = { id: string; name: string; email: string | null; roles: Role[]; createdAt: string };
type AdminSession = { id: string; createdAt: string; expiresAt: string; revokedAt: string | null; user: { id: string; name: string; email: string | null; roles: Role[] } };
const roleOptions: Role[] = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_ADMIN', 'CUSTOMER_SUPPORT', 'VENDOR_MANAGER', 'RIDER_MANAGER', 'MARKETING_MANAGER', 'ANALYST', 'READ_ONLY_ADMIN'];
const createSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(100),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(10, 'Use at least 10 characters.').max(128),
  role: z.enum(['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_ADMIN', 'CUSTOMER_SUPPORT', 'VENDOR_MANAGER', 'RIDER_MANAGER', 'MARKETING_MANAGER', 'ANALYST', 'READ_ONLY_ADMIN']),
  reason: z.string().trim().min(5, 'Give a reason with at least five characters.').max(500),
});
type CreateValues = z.infer<typeof createSchema>;
const labelRole = (role: Role) => role.replaceAll('_', ' ').toLowerCase();
const dateTime = (date: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(date));

export function AccessView() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Role[]>>({});
  const notify = (message: string, isError = false) => { setNotice(message); setNoticeError(isError); };
  const admins = useQuery({ queryKey: ['admin-accounts'], queryFn: () => api<AdminAccount[]>('/admin/admins') });
  const sessions = useQuery({ queryKey: ['admin-sessions'], queryFn: () => api<AdminSession[]>('/admin/sessions') });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { role: 'READ_ONLY_ADMIN' } });

  useEffect(() => {
    if (admins.data) setRoleDrafts(Object.fromEntries(admins.data.map(admin => [admin.id, admin.roles])));
  }, [admins.data]);

  const createAdmin = useMutation({
    mutationFn: (values: CreateValues) => api<AdminAccount>('/admin/admins', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => { notify('Administrator account created.'); reset({ role: 'READ_ONLY_ADMIN', name: '', email: '', password: '', reason: '' }); queryClient.invalidateQueries({ queryKey: ['admin-accounts'] }); },
    onError: error => notify(error instanceof Error ? error.message : 'Account creation failed.', true),
  });
  const changeRoles = useMutation({
    mutationFn: ({ id, roles, reason }: { id: string; roles: Role[]; reason: string }) =>
      api<AdminAccount>(`/admin/admins/${encodeURIComponent(id)}/roles`, { method: 'PATCH', body: JSON.stringify({ roles, reason }) }),
    onSuccess: () => { notify('Administrator permissions updated and audited.'); queryClient.invalidateQueries({ queryKey: ['admin-accounts'] }); },
    onError: error => notify(error instanceof Error ? error.message : 'Role update failed.', true),
  });
  const revokeSession = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/admin/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
    onSuccess: () => { notify('Session revoked and recorded.'); queryClient.invalidateQueries({ queryKey: ['admin-sessions'] }); },
    onError: error => notify(error instanceof Error ? error.message : 'Session revocation failed.', true),
  });

  const submitRoles = (admin: AdminAccount) => {
    const roles = roleDrafts[admin.id] ?? admin.roles;
    if (!roles.length || roles.length > 3) { notify('Select one to three roles.', true); return; }
    const reason = window.prompt('Reason for changing administrator permissions:');
    if (reason === null) return;
    if (reason.trim().length < 5) { notify('Enter a reason with at least five characters.', true); return; }
    if (window.confirm(`Save ${roles.map(labelRole).join(', ')} for ${admin.name}?`)) changeRoles.mutate({ id: admin.id, roles, reason: reason.trim() });
  };
  const onSubmit = handleSubmit(values => createAdmin.mutate(values));

  return <>
    <div className="page-heading"><div><p className="eyebrow">SECURITY &amp; GOVERNANCE</p><h1>Access &amp; sessions</h1><p className="page-description">Manage administrator roles and revoke active sign-in sessions.</p></div></div>
    {notice && <div className={`notice-banner ${noticeError ? 'notice-error' : ''}`} role={noticeError ? 'alert' : 'status'}>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    <div className="access-grid">
      <Card className="panel access-card">
        <div className="panel-heading"><div><p className="eyebrow">NEW ACCOUNT</p><h2>Create administrator</h2></div></div>
        <form className="admin-create-form" onSubmit={onSubmit} noValidate>
          <label>Name<input {...register('name')} autoComplete="name" />{errors.name && <span className="field-error">{errors.name.message}</span>}</label>
          <label>Work email<input {...register('email')} type="email" autoComplete="email" />{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
          <label>Initial password<input {...register('password')} type="password" autoComplete="new-password" />{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
          <label>Role<select {...register('role')}>{roleOptions.map(role => <option key={role} value={role}>{labelRole(role)}</option>)}</select>{errors.role && <span className="field-error">{errors.role.message}</span>}</label>
          <label>Reason<input {...register('reason')} placeholder="Why is this access needed?" />{errors.reason && <span className="field-error">{errors.reason.message}</span>}</label>
          <Button type="submit" disabled={isSubmitting || createAdmin.isPending}>Create account</Button>
          {createAdmin.error && <div className="error-banner" role="alert">{createAdmin.error.message}</div>}
        </form>
        <p className="definition-note">The initial password is set by a super administrator. Email-based reset and MFA delivery are not configured in the current API.</p>
      </Card>
      <Card className="panel data-panel access-list">
        <div className="access-section-heading"><div><p className="eyebrow">ROLE-BASED ACCESS</p><h2>Administrator accounts</h2></div></div>
        {admins.isLoading ? <div className="loading-rows"><span /><span /></div> : admins.error ? <div className="error-state">{admins.error.message}</div> : <div className="table-scroll"><table><thead><tr><th>ADMINISTRATOR</th><th>ROLES</th><th>CREATED</th><th>ACTION</th></tr></thead><tbody>
          {(admins.data ?? []).map(admin => <tr key={admin.id}><td>{admin.name}<small className="table-subtext">{admin.email ?? 'No email'}</small></td><td><select multiple className="role-select" value={roleDrafts[admin.id] ?? admin.roles.filter(role => roleOptions.includes(role))} onChange={event => setRoleDrafts(current => ({ ...current, [admin.id]: Array.from(event.target.selectedOptions).flatMap(option => {
            const selectedRole = roleOptions.find(role => role === option.value);
            return selectedRole ? [selectedRole] : [];
          }) }))} aria-label={`Roles for ${admin.name}`}>{roleOptions.map(role => <option key={role} value={role}>{labelRole(role)}</option>)}</select></td><td>{dateTime(admin.createdAt)}</td><td><Button variant="outline" size="sm" onClick={() => submitRoles(admin)}>Save roles</Button></td></tr>)}
          {!admins.data?.length && <tr><td colSpan={4}>No administrator accounts found.</td></tr>}
        </tbody></table></div>}
      </Card>
      <Card className="panel data-panel access-sessions">
        <div className="access-section-heading"><div><p className="eyebrow">LOGIN HISTORY</p><h2>Administrator sessions</h2></div><span className="record-count">Latest 100 · IP/device history unavailable</span></div>
        {sessions.isLoading ? <div className="loading-rows"><span /><span /></div> : sessions.error ? <div className="error-state">{sessions.error.message}</div> : <div className="table-scroll"><table><thead><tr><th>ADMINISTRATOR</th><th>ROLE</th><th>SIGNED IN</th><th>EXPIRES</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
          {(sessions.data ?? []).map(session => {
            const active = !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now();
            return <tr key={session.id}><td>{session.user.name}<small className="table-subtext">{session.user.email}</small></td><td>{session.user.roles.map(labelRole).join(', ')}</td><td>{dateTime(session.createdAt)}</td><td>{dateTime(session.expiresAt)}</td><td><span className={`status-badge ${active ? 'status-approved' : 'status-cancelled'}`}>{active ? 'active' : session.revokedAt ? 'revoked' : 'expired'}</span></td><td>{active && <Button variant="destructive" size="sm" onClick={() => {
              const reason = window.prompt('Reason for revoking this session:');
              if (reason === null) return;
              if (reason.trim().length < 5) { notify('Enter a reason with at least five characters.', true); return; }
              if (window.confirm('Revoke this administrator session?')) revokeSession.mutate({ id: session.id, reason: reason.trim() });
            }}>Revoke</Button>}</td></tr>;
          })}
          {!sessions.data?.length && <tr><td colSpan={6}>No administrator sessions found.</td></tr>}
        </tbody></table></div>}
      </Card>
    </div>
  </>;
}
