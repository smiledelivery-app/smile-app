'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, MessageSquareWarning, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, queryString } from '@/lib/api';

type Ticket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  resolution: string | null;
  orderId: string | null;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  order: { id: string; status: string; totalMinor: number; createdAt: string } | null;
  createdBy: { id: string; name: string; email: string | null };
  assignedAdmin: { id: string; name: string; email: string | null } | null;
};
type PageResult = { data: Ticket[]; total: number; page: number; pageSize: number };
const categories = ['CUSTOMER_COMPLAINT', 'VENDOR_COMPLAINT', 'RIDER_COMPLAINT', 'ORDER_DISPUTE', 'REFUND_REQUEST', 'PAYMENT_COMPLAINT', 'DELIVERY_COMPLAINT', 'OTHER'];
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(value));
const categoryLabel = (value: string) => value.replaceAll('_', ' ').toLowerCase();

export function DisputesView({ userId, canManage }: { userId: string; canManage: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['disputes', search, status, page],
    queryFn: () => api<PageResult>(`/admin/disputes${queryString({ q: search.trim(), status: status || undefined, page, limit: 15 })}`),
  });
  const changed = () => queryClient.invalidateQueries({ queryKey: ['disputes'] });
  const createTicket = useMutation({
    mutationFn: (body: Record<string, string>) => api<Ticket>('/admin/disputes', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { setShowCreate(false); setMessage('Dispute created and audit logged.'); setErrorMessage(false); void changed(); },
    onError: error => { setMessage(error instanceof Error ? error.message : 'The dispute could not be created.'); setErrorMessage(true); },
  });
  const updateTicket = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string | null> }) =>
      api<Ticket>(`/admin/disputes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { setMessage('Dispute updated and audit logged.'); setErrorMessage(false); void changed(); },
    onError: error => { setMessage(error instanceof Error ? error.message : 'The dispute could not be updated.'); setErrorMessage(true); },
  });
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      subject: String(form.get('subject') ?? ''),
      description: String(form.get('description') ?? ''),
      category: String(form.get('category') ?? 'OTHER'),
      reason: String(form.get('reason') ?? ''),
    };
    const customerId = String(form.get('customerId') ?? '').trim();
    const orderId = String(form.get('orderId') ?? '').trim();
    if (customerId) body.customerId = customerId;
    if (orderId) body.orderId = orderId;
    createTicket.mutate(body);
  };
  const heading = <div className="page-heading"><div><p className="eyebrow">CUSTOMER OPERATIONS</p><h1>Disputes & resolution</h1><p className="page-description">Record complaints, assign ownership, and track outcomes with an audit trail.</p></div>{canManage && <Button className="button button-primary" onClick={() => setShowCreate(value => !value)}><MessageSquareWarning size={14} />{showCreate ? 'Close form' : 'New dispute'}</Button>}</div>;

  return <>
    {heading}
    {message && <div className={`notice-banner ${errorMessage ? 'notice-error' : ''}`} role={errorMessage ? 'alert' : 'status'}>{errorMessage ? <MessageSquareWarning size={15} /> : <Check size={15} />}{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
    {showCreate && canManage && <Card className="panel dispute-create">
      <div className="panel-heading"><div><p className="eyebrow">NEW CASE</p><h2>Record a dispute</h2></div></div>
      <form className="dispute-form" onSubmit={submitCreate}>
        <label>Subject<input name="subject" required minLength={4} maxLength={160} /></label>
        <label>Category<select name="category" defaultValue="ORDER_DISPUTE">{categories.map(item => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></label>
        <label>Customer ID<input name="customerId" placeholder="Optional if an order is linked" /></label>
        <label>Order ID<input name="orderId" placeholder="Optional if a customer is linked" /></label>
        <label className="dispute-span">Complaint details<textarea name="description" rows={3} minLength={10} maxLength={5000} required /></label>
        <label className="dispute-span">Reason for creating this case<textarea name="reason" rows={2} minLength={5} maxLength={500} required /></label>
        <div className="dispute-form-footer"><span>Link a non-demo customer or order. The API verifies ownership and records this action.</span><Button className="button button-primary" disabled={createTicket.isPending}>{createTicket.isPending ? 'Creating…' : 'Create case'}</Button></div>
      </form>
    </Card>}
    <Card className="panel data-panel dispute-list">
      <div className="table-toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search subject, customer, order…" aria-label="Search disputes" /></label>
        <div className="toolbar-right"><select className="filter-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} aria-label="Filter disputes by status"><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select><span className="record-count">{query.data?.total ?? 0} cases</span></div>
      </div>
      {query.isLoading ? <div className="loading-rows" aria-label="Loading"><span /><span /><span /><span /></div>
        : query.error ? <div className="error-state" role="alert">{query.error.message}</div>
          : !query.data?.data.length ? <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><strong>No disputes found</strong><p>Cases returned by the API will appear here. Try changing the filters or record a new dispute.</p></div>
            : <div className="dispute-cases">{query.data.data.map(ticket => <TicketCase key={ticket.id} ticket={ticket} canManage={canManage} userId={userId} update={body => updateTicket.mutate({ id: ticket.id, body })} busy={updateTicket.isPending && updateTicket.variables?.id === ticket.id} />)}</div>}
      {!!query.data?.total && <div className="pagination"><span>Page {page} of {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}</span><div><Button variant="outline" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" className="button button-secondary" disabled={page >= Math.ceil(query.data.total / query.data.pageSize)} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
    </Card>
  </>;
}

function TicketCase({ ticket, canManage, userId, update, busy }: {
  ticket: Ticket;
  canManage: boolean;
  userId: string;
  update: (body: Record<string, string | null>) => void;
  busy: boolean;
}) {
  const [nextStatus, setNextStatus] = useState(ticket.status);
  const [resolution, setResolution] = useState(ticket.resolution ?? '');
  const [reason, setReason] = useState('');
  const save = () => {
    if (reason.trim().length < 5) return;
    update({ status: nextStatus, resolution: resolution.trim() || null, assignedAdminId: userId, reason: reason.trim() });
    setReason('');
  };
  return <article className="dispute-case">
    <div className="dispute-case-header">
      <div><p className="eyebrow">{categoryLabel(ticket.category)} · {dateLabel(ticket.createdAt)}</p><h2>{ticket.subject}</h2></div>
      <span className={`status-badge status-${ticket.status.toLowerCase()}`}>{categoryLabel(ticket.status)}</span>
    </div>
    <p className="dispute-description">{ticket.description}</p>
    <div className="dispute-metadata">
      <span><small>Customer</small><strong>{ticket.customer?.name ?? 'Not linked'}</strong>{ticket.customer?.email ?? ticket.customer?.phone ?? ''}</span>
      <span><small>Order</small><strong>{ticket.orderId ? `#${ticket.orderId.slice(-8).toUpperCase()}` : 'Not linked'}</strong>{ticket.order ? `${categoryLabel(ticket.order.status)} · ${dateLabel(ticket.order.createdAt)}` : ''}</span>
      <span><small>Assigned to</small><strong>{ticket.assignedAdmin?.name ?? 'Unassigned'}</strong>{ticket.assignedAdmin?.id === userId ? 'You' : ticket.assignedAdmin?.email ?? ''}</span>
      <span><small>Last updated</small><strong>{dateLabel(ticket.updatedAt)}</strong>{ticket.createdBy.name ? `Created by ${ticket.createdBy.name}` : ''}</span>
    </div>
    {canManage && <div className="dispute-editor">
      <label>Status<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{statuses.map(value => <option key={value} value={value}>{categoryLabel(value)}</option>)}</select></label>
      <label className="dispute-editor-resolution">Resolution<textarea value={resolution} onChange={event => setResolution(event.target.value)} placeholder="Required when resolving or closing a case" rows={2} maxLength={5000} /></label>
      <label className="dispute-editor-reason">Reason for this update<textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Required audit reason" rows={2} maxLength={500} /></label>
      <Button className="button button-secondary" disabled={busy || reason.trim().length < 5 || ((nextStatus === 'RESOLVED' || nextStatus === 'CLOSED') && !resolution.trim())} onClick={save}><ChevronDown size={13} />{busy ? 'Saving…' : 'Save & assign to me'}</Button>
    </div>}
    {!canManage && ticket.resolution && <div className="dispute-resolution"><strong>Resolution</strong><p>{ticket.resolution}</p></div>}
  </article>;
}
