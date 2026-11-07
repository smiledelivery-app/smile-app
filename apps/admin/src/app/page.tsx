'use client';

import {
  BadgeDollarSign, Bike, BellRing, Check, ChevronDown, CircleAlert, ClipboardList, CreditCard, LayoutDashboard, LogOut,
  MessageSquareWarning, Search, ShieldCheck, Store, UserCog, Users,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AccessView } from '@/app/access-view';
import { DisputesView } from '@/app/disputes-view';
import { NotificationsView } from '@/app/notifications-view';
import { api, getToken, queryString, setToken } from '@/lib/api';

type Role = 'ADMIN' | 'SUPER_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_ADMIN' | 'CUSTOMER_SUPPORT' | 'VENDOR_MANAGER' | 'RIDER_MANAGER' | 'MARKETING_MANAGER' | 'ANALYST' | 'READ_ONLY_ADMIN';
type AdminUser = { userId: string; roles: Role[] };
type View = 'overview' | 'orders' | 'customers' | 'vendors' | 'riders' | 'transactions' | 'disputes' | 'audit' | 'access' | 'notifications';
type Overview = {
  orders: number; completedOrders: number; activeOrders: number; pendingOrders: number; cancelledOrders: number;
  gmvMinor: number; deliveryFeesMinor: number; collectedPaymentsMinor: number; platformRevenueMinor: number | null;
  riderEarningsMinor: number | null; customers: number; activeVendors: number; activeRiders: number;
  averageOrderValueMinor: number | null; averageDeliveryMinutes: number | null; completionRate: number | null;
  recentOrders: Array<{ id: string; status: string; totalMinor: number; createdAt: string; customer: { name: string }; vendor: { name: string } }>;
  trend: Array<{ day: string; orders: number; gmvMinor: number }>;
};
type PageResult<T> = { data: T[]; total: number; page: number; pageSize: number };
type Order = { id: string; status: string; totalMinor: number; subtotalMinor: number; deliveryFeeMinor: number; createdAt: string; customer: { name: string; email: string | null; phone: string | null }; vendor: { name: string }; items: Array<{ nameSnapshot: string; quantity: number }>; payments: Array<{ status: string; provider: string; amountMinor: number }>; delivery: { status: string; assignedRider: { user: { name: string } } | null } | null };
type Customer = { id: string; name: string; email: string | null; phone: string | null; createdAt: string; wallet: { balanceMinor: number; status: string } | null; _count: { orders: number; addresses: number } };
type Vendor = { id: string; name: string; address: string; status: string; isOpen: boolean; createdAt: string; owner: { name: string; email: string | null }; _count: { products: number; orders: number } };
type Rider = { id: string; status: string; available: boolean; vehicleType: string | null; serviceArea: string; createdAt: string; location: { latitude: string; longitude: string; updatedAt: string } | null; user: { name: string; email: string | null; phone: string | null }; _count: { deliveries: number } };
type Transaction = { id: string; orderId: string; amountMinor: number; status: string; provider: string; providerReference: string | null; createdAt: string; order: { status: string; customer: { name: string }; vendor: { name: string } } };
type AuditEntry = { id: string; actorId: string; action: string; targetType: string; targetId: string; metadata: unknown; createdAt: string };
type OrderFilters = { from: string; to: string; vendorId: string; customerId: string; riderId: string; paymentStatus: string };
const emptyOrderFilters: OrderFilters = { from: '', to: '', vendorId: '', customerId: '', riderId: '', paymentStatus: '' };
const routeViews: Record<string, View> = {
  '/': 'overview',
  '/orders': 'orders',
  '/customers': 'customers',
  '/vendors': 'vendors',
  '/riders': 'riders',
  '/transactions': 'transactions',
  '/disputes': 'disputes',
  '/audit': 'audit',
  '/access': 'access',
  '/notifications': 'notifications',
};
const viewRoutes: Record<View, string> = {
  overview: '/',
  orders: '/orders',
  customers: '/customers',
  vendors: '/vendors',
  riders: '/riders',
  transactions: '/transactions',
  disputes: '/disputes',
  audit: '/audit',
  access: '/access',
  notifications: '/notifications',
};
const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'riders', label: 'Riders', icon: Bike },
  { id: 'transactions', label: 'Transactions', icon: CreditCard },
  { id: 'disputes', label: 'Disputes & resolution', icon: MessageSquareWarning },
  { id: 'audit', label: 'Audit log', icon: ShieldCheck },
  { id: 'access', label: 'Access & sessions', icon: UserCog },
  { id: 'notifications', label: 'Push notifications', icon: BellRing },
];
const roleCapabilities: Record<Role, View[]> = {
  ADMIN: ['overview', 'orders', 'customers', 'vendors', 'riders', 'transactions', 'disputes', 'audit', 'access', 'notifications'],
  SUPER_ADMIN: ['overview', 'orders', 'customers', 'vendors', 'riders', 'transactions', 'disputes', 'audit', 'access', 'notifications'],
  OPERATIONS_MANAGER: ['overview', 'orders', 'vendors', 'riders', 'disputes'],
  FINANCE_ADMIN: ['overview', 'transactions'],
  CUSTOMER_SUPPORT: ['overview', 'orders', 'customers', 'disputes'],
  VENDOR_MANAGER: ['overview', 'vendors'],
  RIDER_MANAGER: ['overview', 'riders'],
  MARKETING_MANAGER: ['overview'],
  ANALYST: ['overview', 'orders', 'transactions'],
  READ_ONLY_ADMIN: ['overview', 'orders', 'customers', 'vendors', 'riders', 'transactions', 'disputes', 'audit'],
};
const money = (minor: number | null | undefined) => minor == null ? '—' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(minor / 100);
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(date));
const dateOnly = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'Africa/Lagos' }).format(new Date(value));

function lagosDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`;
}
function periodBounds(period: string) {
  const today = lagosDate();
  if (period === 'yesterday') {
    const yesterday = new Date(`${today}T00:00:00+01:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    const from = `${lagosDate(yesterday)}T00:00:00+01:00`;
    const to = `${today}T00:00:00+01:00`;
    return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  }
  if (period === 'today') return { from: new Date(`${today}T00:00:00+01:00`).toISOString(), to: undefined };
  const days = period === '7d' ? 7 : 30;
  const from = new Date(`${today}T00:00:00+01:00`);
  from.setDate(from.getDate() - days + 1);
  return { from: from.toISOString(), to: undefined };
}
function StatusBadge({ value }: { value: string }) {
  const status = value.replaceAll('_', ' ').toLowerCase();
  return <span className={`status-badge status-${value.toLowerCase()}`}>{status}</span>;
}
function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><strong>No records found</strong><p>{children}</p></div>;
}
function ErrorState({ error }: { error: unknown }) {
  return <div className="error-state" role="alert"><CircleAlert size={18} /><span>{error instanceof Error ? error.message : 'Unable to load platform data.'}</span></div>;
}
function LoadingRows() {
  return <div className="loading-rows" aria-label="Loading"><span /><span /><span /><span /></div>;
}

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const view = routeViews[pathname] ?? 'overview';
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderFilters, setOrderFilters] = useState<OrderFilters>(emptyOrderFilters);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [now, setNow] = useState(0);
  const notify = (message: string, isError = false) => { setNotice(message); setNoticeError(isError); };

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }
    api<AdminUser>('/auth/me').then(admin => {
      if (!admin.roles.some(role => role in roleCapabilities)) throw new Error('This account is not authorized to use the admin dashboard.');
      setUser(admin);
    }).catch(() => { setToken(null); router.replace('/login'); }).finally(() => setReady(true));
  }, [router]);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleNav = useMemo(() => navItems.filter(item => user?.roles.some(role => roleCapabilities[role]?.includes(item.id))), [user]);
  useEffect(() => {
    if (ready && visibleNav.length && !visibleNav.some(item => item.id === view)) router.replace(viewRoutes[visibleNav[0].id]);
  }, [ready, view, visibleNav, router]);
  useEffect(() => {
    setPage(1);
    setSearch('');
    setStatusFilter('');
    setOrderFilters(emptyOrderFilters);
  }, [pathname]);

  const bounds = period === 'custom'
    ? { from: fromDate ? new Date(`${fromDate}T00:00:00+01:00`).toISOString() : undefined, to: toDate ? new Date(new Date(`${toDate}T00:00:00+01:00`).getTime() + 86_400_000).toISOString() : undefined }
    : periodBounds(period);
  const overviewQuery = useQuery({
    queryKey: ['overview', bounds.from, bounds.to],
    queryFn: () => api<Overview>(`/admin/overview${queryString(bounds)}`),
    enabled: ready && view === 'overview' && (period !== 'custom' || (!!fromDate && !!toDate && fromDate <= toDate)),
    refetchInterval: 30_000,
  });
  const listQuery = useQuery({
    queryKey: [view, search, statusFilter, page, orderFilters],
    queryFn: () => api<PageResult<Order | Customer | Vendor | Rider | Transaction>>(`/admin/${view === 'transactions' ? 'transactions' : view}${queryString({
      q: search.trim(), status: statusFilter || undefined, page, limit: 20,
      from: orderFilters.from ? new Date(`${orderFilters.from}T00:00:00+01:00`).toISOString() : undefined,
      to: orderFilters.to ? new Date(new Date(`${orderFilters.to}T00:00:00+01:00`).getTime() + 86_400_000).toISOString() : undefined,
      vendorId: orderFilters.vendorId.trim() || undefined, customerId: orderFilters.customerId.trim() || undefined,
      riderId: orderFilters.riderId.trim() || undefined, paymentStatus: orderFilters.paymentStatus || undefined,
    })}`),
    enabled: ready && ['orders', 'customers', 'vendors', 'riders', 'transactions'].includes(view),
    refetchInterval: view === 'orders' || view === 'riders' ? 15_000 : false,
  });
  const auditQuery = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api<AuditEntry[]>(`/admin/audit-logs${queryString({ limit: 50, cursor: undefined })}`),
    enabled: ready && view === 'audit',
  });

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setToken(null);
      queryClient.clear();
      router.replace('/login');
    } catch (error) {
      notify(error instanceof Error ? `Sign-out failed: ${error.message}` : 'Sign-out failed. Try again.', true);
    }
  };
  const review = useMutation({
    mutationFn: async ({ type, id, status, reason }: { type: 'vendors' | 'riders'; id: string; status: string; reason: string }) =>
      api(`/admin/${type}/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
    onSuccess: () => { notify('Review decision saved and recorded.'); queryClient.invalidateQueries({ queryKey: ['vendors'] }); queryClient.invalidateQueries({ queryKey: ['riders'] }); queryClient.invalidateQueries({ queryKey: ['overview'] }); },
    onError: error => notify(error instanceof Error ? error.message : 'The review decision could not be saved.', true),
  });

  const canReview = (permission: 'vendors' | 'riders') => user?.roles.some(role => role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER' || role === (permission === 'vendors' ? 'VENDOR_MANAGER' : 'RIDER_MANAGER'));
  const runReview = (type: 'vendors' | 'riders', id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    const reason = window.prompt(`Reason for ${status.toLowerCase().replace('_', ' ')}:`);
    if (reason === null) return;
    if (reason.trim().length < 5) { notify('Enter a reason with at least five characters.', true); return; }
    if (window.confirm(`Confirm ${status.toLowerCase().replace('_', ' ')}? This decision will be added to the audit log.`)) review.mutate({ type, id, status, reason: reason.trim() });
  };

  if (!ready || !user) return <main className="boot-screen"><Image className="brand-mark-image" src="/smile-logo.png" width={32} height={32} alt="" /><span>Checking administrator session…</span></main>;
  const currentLabel = navItems.find(item => item.id === view)?.label ?? 'Overview';

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/" aria-label="Smile admin home"><Image className="brand-mark-image" src="/smile-logo.png" width={32} height={32} alt="" priority /><span>smile<span className="brand-period">.</span></span></Link>
        <div className="workspace-label">PLATFORM</div>
        <nav className="side-nav" aria-label="Admin navigation">
          {visibleNav.map(item => {
            const Icon = item.icon;
            return <Link key={item.id} aria-label={item.label} title={item.label} href={viewRoutes[item.id]} className={`nav-item ${view === item.id ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'orders' && <span className="nav-live-dot" />}</Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><span>Connected to API</span></div>
          <div className="profile-chip"><span className="avatar">{(user.userId || 'A').slice(0, 1).toUpperCase()}</span><div className="profile-name"><strong>Administrator</strong><small>{user.roles[0]?.replaceAll('_', ' ')}</small></div><button title="Sign out" className="icon-button" onClick={logout}><LogOut size={16} /></button></div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="top-header">
          <div className="breadcrumbs"><span>Platform</span><span className="crumb-slash">/</span><strong>{currentLabel}</strong></div>
          <div className="header-right"><span className="timezone"><span className="status-dot" /> Africa/Lagos</span><span className="header-divider" /><span className="current-time">{now ? new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(now) : '--:--'}</span><button className="icon-button header-user" title="Administrator"><span className="avatar avatar-small">{(user.userId || 'A').slice(0, 1).toUpperCase()}</span></button></div>
        </header>
        <div className="page-content">
          {notice && <div className={`notice-banner ${noticeError ? 'notice-error' : ''}`} role={noticeError ? 'alert' : 'status'}>{noticeError ? <CircleAlert size={16} /> : <Check size={16} />}{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {view === 'overview' && <OverviewView data={overviewQuery.data} error={overviewQuery.error} loading={overviewQuery.isLoading} period={period} setPeriod={setPeriod} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} />}
          {view !== 'overview' && view !== 'audit' && view !== 'access' && view !== 'disputes' && view !== 'notifications' && <ListView view={view} query={listQuery} search={search} setSearch={value => { setSearch(value); setPage(1); }} statusFilter={statusFilter} setStatusFilter={value => { setStatusFilter(value); setPage(1); }} page={page} setPage={setPage} canReview={canReview} runReview={runReview} orderFilters={orderFilters} setOrderFilters={filters => { setOrderFilters(filters); setPage(1); }} />}
          {view === 'audit' && <AuditView query={auditQuery} />}
          {view === 'access' && <AccessView />}
          {view === 'disputes' && <DisputesView userId={user.userId} canManage={user.roles.some(role => role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER' || role === 'CUSTOMER_SUPPORT')} />}
          {view === 'notifications' && <NotificationsView />}
        </div>
      </main>
    </div>
  );
}

function OverviewView({ data, error, loading, period, setPeriod, fromDate, toDate, setFromDate, setToDate }: {
  data?: Overview; error: unknown; loading: boolean; period: string; setPeriod: (period: string) => void; fromDate: string; toDate: string;
  setFromDate: (value: string) => void; setToDate: (value: string) => void;
}) {
  if (error) return <><PageHeading eyebrow="PLATFORM HEALTH" title="Overview" description="Operational and financial performance, from the source systems." /><ErrorState error={error} /></>;
  const cards = [
    { label: 'Delivered orders', value: data?.completedOrders.toLocaleString() ?? '—', foot: `${data?.activeOrders ?? 0} currently active`, icon: ClipboardList, tone: 'green' },
    { label: 'GMV', value: money(data?.gmvMinor), foot: 'Product subtotal · delivered only', icon: BadgeDollarSign, tone: 'olive' },
    { label: 'Customers', value: data?.customers.toLocaleString() ?? '—', foot: 'Non-demo registered accounts', icon: Users, tone: 'blue' },
    { label: 'Approved vendors', value: data?.activeVendors.toLocaleString() ?? '—', foot: `${data?.activeRiders ?? 0} riders available`, icon: Store, tone: 'sand' },
  ];
  return <>
    <PageHeading eyebrow="PLATFORM HEALTH" title="Overview" description="Operational and financial performance, from the source systems.">
      <div className="period-control">
        <select value={period} onChange={event => {
          const value = event.target.value;
          setPeriod(value);
          if (value === 'custom') {
            setToDate(lagosDate());
            const start = new Date(`${lagosDate()}T00:00:00+01:00`);
            start.setDate(start.getDate() - 6);
            setFromDate(lagosDate(start));
          }
        }} aria-label="Dashboard date range">
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="custom">Custom range</option>
        </select><ChevronDown size={14} />
      </div>
    </PageHeading>
    {period === 'custom' && <div className="date-range"><label>From <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label><label>To <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label></div>}
    {period === 'custom' && fromDate > toDate && <div className="error-banner" role="alert">The start date must be on or before the end date.</div>}
    {loading ? <LoadingRows /> : <>
      <section className="metric-grid">
        {cards.map(({ label, value, foot, icon: Icon, tone }) => <Card key={label} className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div><strong>{value}</strong><small>{foot}</small></Card>)}
      </section>
      <section className="secondary-metrics">
        <div><span>Orders</span><strong>{data?.orders.toLocaleString() ?? '—'}</strong></div><div><span>Awaiting payment</span><strong>{data?.pendingOrders.toLocaleString() ?? '—'}</strong></div><div><span>Cancelled / rejected</span><strong>{data?.cancelledOrders.toLocaleString() ?? '—'}</strong></div><div><span>Avg. order value</span><strong>{money(data?.averageOrderValueMinor)}</strong></div><div><span>Avg. delivery</span><strong>{data?.averageDeliveryMinutes == null ? '—' : `${data.averageDeliveryMinutes} min`}</strong></div><div><span>Completion rate</span><strong>{data?.completionRate == null ? '—' : `${Math.round(data.completionRate * 100)}%`}</strong></div>
      </section>
      <section className="content-grid">
        <Card className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">ORDER ACTIVITY</p><h2>Orders &amp; GMV</h2></div><span className="chart-legend"><i /> Orders <i className="legend-olive" /> GMV</span></div>
          {!data?.trend.length ? <EmptyState>No order activity was recorded for this period.</EmptyState> : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs><linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d8e5df" stopOpacity={0.75} /><stop offset="100%" stopColor="#d8e5df" stopOpacity={0.08} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#edf0eb" /><XAxis dataKey="day" tickFormatter={value => value.slice(5)} tickLine={false} axisLine={false} fontSize={11} stroke="#829088" /><YAxis yAxisId="orders" tickLine={false} axisLine={false} fontSize={11} stroke="#829088" width={34} /><YAxis yAxisId="gmv" orientation="right" tickFormatter={value => `${Math.round(value / 100000) / 10}m`} tickLine={false} axisLine={false} fontSize={10} stroke="#829088" width={42} /><Tooltip formatter={(value, name) => [name === 'gmvMinor' ? money(Number(value)) : value, name === 'gmvMinor' ? 'GMV' : 'Orders']} labelFormatter={value => dateOnly(`${value}T12:00:00`)} />
            <Area yAxisId="gmv" type="monotone" dataKey="gmvMinor" stroke="#a2b95f" strokeWidth={2} fill="url(#gmvFill)" /><Area yAxisId="orders" type="monotone" dataKey="orders" stroke="#176b4d" strokeWidth={2} fill="transparent" />
          </AreaChart></ResponsiveContainer></div>}
        </Card>
        <Card className="panel financial-panel">
          <div className="panel-heading"><div><p className="eyebrow">FINANCIAL SNAPSHOT</p><h2>Collected &amp; fees</h2></div><BadgeDollarSign size={19} className="muted-icon" /></div>
          <div className="finance-row"><div><span>Successful payments</span><small>Recorded collections · non-demo</small></div><strong>{money(data?.collectedPaymentsMinor)}</strong></div>
          <div className="finance-row"><div><span>Delivery fees</span><small>Customer fees on delivered orders</small></div><strong>{money(data?.deliveryFeesMinor)}</strong></div>
          <div className="finance-row unavailable"><div><span>Platform revenue</span><small>Not tracked in the current ledger</small></div><strong>Not available</strong></div>
          <div className="finance-row unavailable"><div><span>Rider earnings</span><small>No payout rules/ledger configured</small></div><strong>Not available</strong></div>
          <p className="definition-note">Collected payments, GMV, delivery fees, platform revenue, and rider earnings are distinct measures. This API does not infer missing ledger values.</p>
        </Card>
      </section>
      <Card className="panel recent-panel">
        <div className="panel-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>Recent orders</h2></div><span className="live-label"><span className="status-dot" /> LIVE</span></div>
        {!data?.recentOrders.length ? <EmptyState>Orders placed during this period will appear here.</EmptyState> : <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>VENDOR</th><th>PLACED</th><th>STATUS</th><th className="align-right">TOTAL</th></tr></thead><tbody>
          {data.recentOrders.map(order => <tr key={order.id}><td className="mono">#{order.id.slice(-8).toUpperCase()}</td><td>{order.customer.name}</td><td>{order.vendor.name}</td><td>{dateLabel(order.createdAt)}</td><td><StatusBadge value={order.status} /></td><td className="align-right money-cell">{money(order.totalMinor)}</td></tr>)}
        </tbody></table></div>}
      </Card>
    </>}
  </>;
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children}</div>;
}

function ListView({ view, query, search, setSearch, statusFilter, setStatusFilter, page, setPage, canReview, runReview, orderFilters, setOrderFilters }: {
  view: Exclude<View, 'overview' | 'audit' | 'access' | 'disputes' | 'notifications'>; query: UseQueryResult<PageResult<Order | Customer | Vendor | Rider | Transaction>, Error>; search: string;
  setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; page: number; setPage: (page: number) => void;
  orderFilters: OrderFilters; setOrderFilters: (filters: OrderFilters) => void;
  canReview: (permission: 'vendors' | 'riders') => boolean | undefined;
  runReview: (type: 'vendors' | 'riders', id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => void;
}) {
  const labels: Record<typeof view, { title: string; description: string; eyebrow: string }> = {
    orders: { title: 'Orders', description: 'Search orders and inspect their customer, vendor, payment, and delivery status.', eyebrow: 'FULFILLMENT' },
    customers: { title: 'Customers', description: 'Customer accounts and order activity. Credentials are never shown.', eyebrow: 'CUSTOMER DIRECTORY' },
    vendors: { title: 'Vendors', description: 'Review applications and monitor approved vendor operations.', eyebrow: 'VENDOR NETWORK' },
    riders: { title: 'Riders', description: 'Review rider applications and only display recently updated locations.', eyebrow: 'DELIVERY FLEET' },
    transactions: { title: 'Payment transactions', description: 'Read-only payment records from the existing gateway integration.', eyebrow: 'FINANCE' },
  };
  const title = labels[view];
  const data = query.data?.data ?? [];
  const statusOptions = view === 'orders' ? ['PENDING_PAYMENT', 'CONFIRMED', 'ACCEPTED_BY_VENDOR', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'PAYMENT_FAILED', 'CANCELLED', 'REJECTED', 'REFUNDED']
    : view === 'vendors' || view === 'riders' ? ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']
      : view === 'transactions' ? ['SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED'] : [];
  const canManage = view === 'vendors' ? canReview('vendors') : view === 'riders' ? canReview('riders') : false;
  return <>
    <PageHeading {...title} />
    <Card className="panel data-panel">
      <div className="table-toolbar">
        <label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${view}…`} aria-label={`Search ${view}`} /></label>
        <div className="toolbar-right">{statusOptions.length > 0 && <select className="filter-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statusOptions.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select>}<span className="record-count">{query.data?.total ?? 0} records</span></div>
      </div>
      {view === 'orders' && <OrderFilterBar filters={orderFilters} onChange={setOrderFilters} />}
      {query.isLoading ? <LoadingRows /> : query.error ? <ErrorState error={query.error} /> : !data.length ? <EmptyState>Try another search or clear the selected filters.</EmptyState> : <div className="table-scroll"><table><TableHead view={view} /><tbody>
        {view === 'orders' && (data as Order[]).map(order => <tr key={order.id}><td className="mono">#{order.id.slice(-8).toUpperCase()}</td><td>{order.customer.name}<small className="table-subtext">{order.customer.phone ?? order.customer.email}</small></td><td>{order.vendor.name}</td><td>{dateLabel(order.createdAt)}</td><td><StatusBadge value={order.status} /></td><td>{order.delivery?.assignedRider?.user.name ?? 'Unassigned'}</td><td className="align-right money-cell">{money(order.totalMinor)}</td><td><details className="row-details"><summary>Details</summary><div className="details-popover"><strong>Order breakdown</strong><span>Products: {money(order.subtotalMinor)}</span><span>Delivery fee: {money(order.deliveryFeeMinor)}</span><span>Items: {order.items.map(item => `${item.quantity} × ${item.nameSnapshot}`).join(', ') || 'No item details'}</span><span>Payment: {order.payments[0] ? `${order.payments[0].provider} · ${order.payments[0].status}` : 'No payment record'}</span></div></details></td></tr>)}
        {view === 'customers' && (data as Customer[]).map(customer => <tr key={customer.id}><td>{customer.name}</td><td>{customer.email ?? '—'}</td><td>{customer.phone ?? '—'}</td><td>{customer._count.orders}</td><td>{customer._count.addresses}</td><td>{money(customer.wallet?.balanceMinor)}</td><td>{dateOnly(customer.createdAt)}</td></tr>)}
        {view === 'vendors' && (data as Vendor[]).map(vendor => <tr key={vendor.id}><td>{vendor.name}<small className="table-subtext">{vendor.owner.name}</small></td><td>{vendor.address}</td><td><StatusBadge value={vendor.status} /></td><td>{vendor.isOpen ? 'Open' : 'Closed'}</td><td>{vendor._count.products}</td><td>{vendor._count.orders}</td><td>{dateOnly(vendor.createdAt)}</td><td>{canManage && <ReviewActions status={vendor.status} onSelect={status => runReview('vendors', vendor.id, status)} />}</td></tr>)}
        {view === 'riders' && (data as Rider[]).map(rider => <tr key={rider.id}><td>{rider.user.name}<small className="table-subtext">{rider.user.phone ?? rider.user.email}</small></td><td>{rider.vehicleType ?? '—'}</td><td>{rider.serviceArea || '—'}</td><td><StatusBadge value={rider.status} /></td><td>{rider.available ? rider.location ? 'Available' : 'Location stale' : 'Offline'}</td><td>{rider.location ? `${dateLabel(rider.location.updatedAt)} · fresh` : 'Location unavailable'}</td><td>{rider._count.deliveries}</td><td>{canManage && <ReviewActions status={rider.status} onSelect={status => runReview('riders', rider.id, status)} />}</td></tr>)}
        {view === 'transactions' && (data as Transaction[]).map(transaction => <tr key={transaction.id}><td className="mono">{transaction.providerReference ?? transaction.id}</td><td>#{transaction.orderId.slice(-8).toUpperCase()}</td><td>{transaction.order.customer.name}</td><td>{transaction.order.vendor.name}</td><td>{transaction.provider}</td><td><StatusBadge value={transaction.status} /></td><td>{dateLabel(transaction.createdAt)}</td><td className="align-right money-cell">{money(transaction.amountMinor)}</td></tr>)}
      </tbody></table></div>}
      {!!query.data?.total && <div className="pagination"><span>Page {page} of {Math.max(1, Math.ceil(query.data.total / query.data.pageSize))}</span><div><Button variant="outline" className="button button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" className="button button-secondary" disabled={page >= Math.ceil(query.data.total / query.data.pageSize)} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
    </Card>
  </>;
}

function OrderFilterBar({ filters, onChange }: { filters: OrderFilters; onChange: (filters: OrderFilters) => void }) {
  const update = (key: keyof OrderFilters, value: string) => onChange({ ...filters, [key]: value });
  return <div className="order-filter-bar">
    <label>From <input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
    <label>To <input type="date" value={filters.to} onChange={event => update('to', event.target.value)} /></label>
    <input aria-label="Vendor ID" placeholder="Vendor ID" value={filters.vendorId} onChange={event => update('vendorId', event.target.value)} />
    <input aria-label="Customer ID" placeholder="Customer ID" value={filters.customerId} onChange={event => update('customerId', event.target.value)} />
    <input aria-label="Rider ID" placeholder="Rider ID" value={filters.riderId} onChange={event => update('riderId', event.target.value)} />
    <select aria-label="Payment status" value={filters.paymentStatus} onChange={event => update('paymentStatus', event.target.value)}><option value="">All payments</option><option value="SUCCEEDED">Succeeded</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select>
    <Button variant="outline" size="sm" onClick={() => onChange(emptyOrderFilters)}>Clear filters</Button>
  </div>;
}

function TableHead({ view }: { view: Exclude<View, 'overview' | 'audit' | 'access' | 'disputes' | 'notifications'> }) {
  const columns: Record<typeof view, string[]> = {
    orders: ['ORDER', 'CUSTOMER', 'VENDOR', 'PLACED', 'STATUS', 'RIDER', 'TOTAL', ''],
    customers: ['CUSTOMER', 'EMAIL', 'PHONE', 'ORDERS', 'ADDRESSES', 'WALLET BALANCE', 'JOINED'],
    vendors: ['VENDOR / OWNER', 'LOCATION', 'STATUS', 'STORE', 'PRODUCTS', 'ORDERS', 'JOINED', 'ACTIONS'],
    riders: ['RIDER', 'VEHICLE', 'SERVICE AREA', 'STATUS', 'AVAILABILITY', 'LOCATION UPDATE', 'DELIVERIES', 'ACTIONS'],
    transactions: ['REFERENCE', 'ORDER', 'CUSTOMER', 'VENDOR', 'PROVIDER', 'STATUS', 'CREATED', 'AMOUNT'],
  };
  return <thead><tr>{columns[view].map((column, index) => <th key={`${column}-${index}`} className={column === 'TOTAL' || column === 'AMOUNT' ? 'align-right' : ''}>{column}</th>)}</tr></thead>;
}

function ReviewActions({ status, onSelect }: { status: string; onSelect: (status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => void }) {
  return <div className="review-actions">{status !== 'APPROVED' && <Button className="button button-compact button-primary" onClick={() => onSelect('APPROVED')}>Approve</Button>}{status !== 'REJECTED' && <Button variant="outline" className="button button-compact button-secondary" onClick={() => onSelect('REJECTED')}>Reject</Button>}{status !== 'SUSPENDED' && status === 'APPROVED' && <Button variant="destructive" className="button button-compact button-danger" onClick={() => onSelect('SUSPENDED')}>Suspend</Button>}</div>;
}

function AuditView({ query }: { query: UseQueryResult<AuditEntry[], Error> }) {
  return <>
    <PageHeading eyebrow="GOVERNANCE" title="Audit log" description="Sensitive administrative actions recorded by the API." />
    <Card className="panel data-panel">
      {query.isLoading ? <LoadingRows /> : query.error ? <ErrorState error={query.error} /> : !query.data?.length ? <EmptyState>No audit records were returned.</EmptyState> : <div className="table-scroll"><table><thead><tr><th>TIME</th><th>ADMINISTRATOR</th><th>ACTION</th><th>RESOURCE</th><th>REASON / DETAILS</th></tr></thead><tbody>{query.data.map(entry => <tr key={entry.id}><td>{dateLabel(entry.createdAt)}</td><td className="mono">{entry.actorId}</td><td><StatusBadge value={entry.action} /></td><td>{entry.targetType} <span className="mono">{entry.targetId}</span></td><td className="audit-meta">{JSON.stringify(entry.metadata ?? {})}</td></tr>)}</tbody></table></div>}
    </Card>
  </>;
}
