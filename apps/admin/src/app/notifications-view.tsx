'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BellRing, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

type Audience = 'CUSTOMERS' | 'VENDORS' | 'RIDERS' | 'ALL';
type BroadcastResult = {
  recipientCount: number;
  push: { attempted: number; accepted: number; failed: number; error?: string };
};

export function NotificationsView() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('CUSTOMERS');
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const send = useMutation({
    mutationFn: () => api<BroadcastResult>('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
    }),
    onSuccess: response => { setResult(response); setTitle(''); setBody(''); },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    send.mutate();
  };

  return <>
    <div className="page-heading"><div><p className="eyebrow">CUSTOMER COMMUNICATION</p><h1>Push notifications</h1><p className="page-description">Send a message to registered non-demo accounts in the selected audience.</p></div></div>
    <Card className="panel notification-composer">
      <div className="panel-heading"><div><p className="eyebrow">NEW BROADCAST</p><h2>Compose notification</h2></div><BellRing size={19} className="muted-icon"/></div>
      <form className="notification-form" onSubmit={submit}>
        <label>Recipient group<select value={audience} onChange={event => setAudience(event.target.value as Audience)}><option value="CUSTOMERS">Customers</option><option value="VENDORS">Vendors</option><option value="RIDERS">Riders</option><option value="ALL">All customers, vendors, and riders</option></select></label>
        <label>Title <span>{title.length}/80</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} required minLength={2}/></label>
        <label>Message <span>{body.length}/240</span><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={240} required minLength={2} rows={5}/></label>
        <p className="definition-note">The message is saved to each recipient’s in-app inbox. Push delivery is best-effort and requires an installed app with notifications enabled.</p>
        <Button type="submit" disabled={send.isPending||title.trim().length<2||body.trim().length<2}>{send.isPending?'Sending…':'Send notification'}</Button>
      </form>
      {send.error&&<div className="error-state" role="alert"><CircleAlert size={18}/><span>{send.error.message}</span></div>}
      {result&&<div className="notification-result" role="status">
        <strong>Saved for {result.recipientCount} recipient{result.recipientCount===1?'':'s'}.</strong>
        <span>Push accepted by Expo: {result.push.accepted}/{result.push.attempted} devices; {result.push.failed} failed.</span>
        {result.push.error&&<span className="notification-warning">{result.push.error}</span>}
        {!result.recipientCount&&<span>No accounts currently match this audience.</span>}
      </div>}
    </Card>
  </>;
}
