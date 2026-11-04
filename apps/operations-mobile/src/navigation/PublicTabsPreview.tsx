import { AppText as Text } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppColors } from '../theme/colors';
import RoleTabBar, { type RiderTab, type VendorTab } from './RoleTabBar';

type Role = 'VENDOR' | 'RIDER';
type Tab = VendorTab | RiderTab;

const tabCopy: Record<Tab, { title: string; description: string }> = {
  overview: { title: 'Store overview', description: 'Sign in to manage your store and view current order activity.' },
  orders: { title: 'Store orders', description: 'Sign in to review and update your store orders.' },
  products: { title: 'Products & extras', description: 'Sign in to manage your menu, prices, and availability.' },
  home: { title: 'Rider workspace', description: 'Sign in to manage rider availability and your service area.' },
  offers: { title: 'Delivery offers', description: 'Sign in as an approved rider to receive eligible delivery offers.' },
  deliveries: { title: 'Deliveries', description: 'Sign in to view assigned deliveries and confirm handoffs.' },
  account: { title: 'Your account', description: 'Sign in to access your Smile Operations account.' },
};

export default function PublicTabsPreview({ colors, onBackToSignIn }: { colors: AppColors; onBackToSignIn: () => void }) {
  const [role, setRole] = useState<Role>('VENDOR');
  const [tab, setTab] = useState<Tab>('overview');
  const [orders, setOrders] = useState([
    { id: 'ORD-2408', customer: 'Nneka O.', items: '2 × Smoky jollof · 1 × Zobo', total: '₦8,600', status: 'NEW' },
    { id: 'ORD-2407', customer: 'Tobi A.', items: '1 × Beef suya bowl', total: '₦5,400', status: 'PREPARING' },
  ]);
  const [products, setProducts] = useState([
    { name: 'Smoky party jollof', price: '₦3,800', available: true },
    { name: 'Beef suya bowl', price: '₦4,200', available: true },
    { name: 'Chilled zobo', price: '₦900', available: false },
  ]);
  const [online, setOnline] = useState(false);
  const [hasOffer, setHasOffer] = useState(true);
  const [deliveryStatus, setDeliveryStatus] = useState<'NONE' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED'>('NONE');
  const [message, setMessage] = useState('');
  const copy = tabCopy[tab];
  const styles = createStyles(colors);

  const selectRole = (next: Role) => {
    setRole(next);
    setTab(next === 'VENDOR' ? 'overview' : 'home');
    setMessage('');
  };

  const advanceOrder = (id: string) => {
    const progression: Record<string, string> = { NEW: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED', COMPLETED: 'COMPLETED' };
    setOrders(rows => rows.map(order => order.id === id ? { ...order, status: progression[order.status] ?? order.status } : order));
    setMessage('Sample order updated on this device only.');
  };
  const progressDelivery = () => {
    setDeliveryStatus(current => current === 'ASSIGNED' ? 'PICKED_UP' : 'DELIVERED');
    setMessage('Sample delivery updated on this device only.');
  };

  return <View style={styles.flex}>
    <View style={styles.roleSwitch}>
      {(['VENDOR', 'RIDER'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: role === item }} onPress={() => selectRole(item)} style={[styles.roleTab, role === item && styles.roleTabActive]}>
        <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'VENDOR' ? 'Vendor' : 'Rider'}</Text>
      </Pressable>)}
    </View>
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SMILE OPERATIONS · LOCAL DEMO</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      <Text style={styles.demoNote}>Sample data only. Actions update this preview; nothing is sent to a server.</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {role === 'VENDOR' && tab === 'overview' && <>
        <View style={styles.stats}><Stat label="TODAY'S ORDERS" value="12" styles={styles}/><Stat label="TODAY'S SALES" value="₦84,500" styles={styles}/></View>
        <View style={styles.card}><Text style={styles.cardTitle}>Kitchen status</Text><Text style={styles.cardCopy}>Open · Yaba · 25–35 min</Text></View>
        <OrderList orders={orders.slice(0, 2)} styles={styles} onAdvance={advanceOrder}/>
      </>}
      {role === 'VENDOR' && tab === 'orders' && <OrderList orders={orders} styles={styles} onAdvance={advanceOrder}/>}
      {role === 'VENDOR' && tab === 'products' && <View style={styles.card}>
        <Text style={styles.cardTitle}>Menu availability</Text>
        {products.map((product, index) => <Pressable key={product.name} accessibilityRole="switch" accessibilityState={{ checked: product.available }} onPress={() => setProducts(rows => rows.map((row, i) => i === index ? { ...row, available: !row.available } : row))} style={styles.row}>
          <View style={styles.productCopy}><Text style={styles.cardTitle}>{product.name}</Text><Text style={styles.cardCopy}>{product.price}</Text></View>
          <Text style={[styles.pill, product.available && styles.pillOn]}>{product.available ? 'AVAILABLE' : 'SOLD OUT'}</Text>
        </Pressable>)}
      </View>}
      {role === 'VENDOR' && tab === 'account' && <View style={styles.card}><Text style={styles.cardTitle}>Ada’s Kitchen</Text><Text style={styles.cardCopy}>Yaba · Nigerian comfort food</Text><Text style={styles.cardCopy}>Store status: Active</Text></View>}
      {role === 'RIDER' && tab === 'home' && <>
        <View style={styles.card}><Text style={styles.cardTitle}>{online ? 'You’re online' : 'Ready when you are'}</Text><Text style={styles.cardCopy}>Motorcycle · Yaba service area</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: online }} onPress={() => setOnline(value => !value)} style={styles.button}><Text style={styles.buttonText}>{online ? 'Go offline' : 'Go online'}</Text></Pressable></View>
        <View style={styles.stats}><Stat label="DELIVERIES TODAY" value="4" styles={styles}/><Stat label="EARNINGS" value="₦12,800" styles={styles}/></View>
      </>}
      {role === 'RIDER' && tab === 'offers' && <View style={styles.card}>
        <Text style={styles.cardTitle}>Nearby delivery offers</Text>
        {!online ? <Text style={styles.cardCopy}>Switch to online on the Home tab to view offers.</Text> : !hasOffer ? <Text style={styles.cardCopy}>No sample offers remaining. Go online and refresh to explore again.</Text> : <>
          <Text style={styles.cardCopy}>Ada’s Kitchen → Sabo, Yaba</Text><Text style={styles.cardCopy}>2 items · 1.8 km pickup · ₦1,400 estimated</Text>
          <View style={styles.actions}><Pressable onPress={() => { setHasOffer(false); setDeliveryStatus('ASSIGNED'); setMessage('Sample offer accepted locally.'); }} style={styles.button}><Text style={styles.buttonText}>Accept offer</Text></Pressable><Pressable onPress={() => setHasOffer(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Skip</Text></Pressable></View>
        </>}
      </View>}
      {role === 'RIDER' && tab === 'deliveries' && <View style={styles.card}>
        <Text style={styles.cardTitle}>Sample delivery</Text>
        {deliveryStatus === 'NONE' ? <Text style={styles.cardCopy}>Accept the sample offer to see pickup and delivery steps.</Text> : <>
          <Text style={styles.cardCopy}>Pick up at Ada’s Kitchen · 12 Akin Street</Text><Text style={styles.cardCopy}>Deliver to Sabo, Yaba · 2 items</Text><Text style={styles.pill}>{deliveryStatus.replaceAll('_', ' ')}</Text>
          {deliveryStatus !== 'DELIVERED' && <Pressable onPress={progressDelivery} style={styles.button}><Text style={styles.buttonText}>{deliveryStatus === 'ASSIGNED' ? 'Simulate pickup' : 'Simulate delivery'}</Text></Pressable>}
        </>}
      </View>}
      {role === 'RIDER' && tab === 'account' && <View style={styles.card}><Text style={styles.cardTitle}>Rider profile</Text><Text style={styles.cardCopy}>Status: Approved (sample)</Text><Text style={styles.cardCopy}>Vehicle: Motorcycle</Text><Text style={styles.cardCopy}>Service area: Yaba</Text></View>}
      <Pressable accessibilityRole="button" onPress={onBackToSignIn} style={styles.button}><Text style={styles.buttonText}>Go to sign in</Text></Pressable>
    </ScrollView>
    <RoleTabBar role={role} active={tab} onSelect={setTab} colors={colors}/>
  </View>;
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function OrderList({ orders, styles, onAdvance }: { orders: { id: string; customer: string; items: string; total: string; status: string }[]; styles: ReturnType<typeof createStyles>; onAdvance: (id: string) => void }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>Sample orders</Text>{orders.map(order => <View key={order.id} style={styles.order}>
    <Text style={styles.cardTitle}>{order.customer} · {order.id}</Text><Text style={styles.cardCopy}>{order.items}</Text><View style={styles.row}><Text style={styles.cardCopy}>{order.total} · {order.status}</Text>{order.status !== 'COMPLETED' && <Pressable onPress={() => onAdvance(order.id)}><Text style={styles.link}>Advance</Text></Pressable>}</View>
  </View>)}</View>;
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  flex: { flex: 1 },
  roleSwitch: { height: 46, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  roleTab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  roleTabActive: { borderBottomWidth: 2, borderBottomColor: colors.green },
  roleText: { fontSize: 15, color: colors.muted },
  roleTextActive: { fontWeight: '800', color: colors.green },
  content: { flexGrow: 1, padding: 18, paddingBottom: 26 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: colors.green },
  title: { marginTop: 8, fontSize: 30, fontWeight: '900', color: colors.ink },
  description: { marginTop: 7, fontSize: 15, lineHeight: 22, color: colors.muted },
  card: {marginTop: 12,padding: 15,gap: 9,borderWidth:0,borderRadius:0,backgroundColor:colors.card,borderBottomWidth:1,borderBottomColor:colors.line},
  cardTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
  cardCopy: { marginTop: 6, fontSize: 13, lineHeight: 21, color: colors.muted },
  button: { minHeight: 42, marginTop: 8, paddingHorizontal: 14, borderRadius:0, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, fontWeight: '800', color: colors.isDark ? '#17231b' : 'white' },
  demoNote: { padding: 10, borderRadius:0, backgroundColor: colors.cream, color: colors.green, fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 10 },
  message: { color: colors.green, fontSize: 12, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 9, marginTop: 12 },
  stat: { flex: 1, padding: 13, borderRadius:0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.ink },
  statLabel: { fontSize: 10, fontWeight: '800', color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line },
  productCopy: { flex: 1 },
  pill: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '900', color: colors.muted, backgroundColor: colors.cream, paddingHorizontal: 9, paddingVertical: 6, borderRadius:0, overflow: 'hidden' },
  pillOn: { color: colors.green, backgroundColor: colors.isDark ? '#263923' : '#e9f3d7' },
  actions: { flexDirection: 'row', gap: 9 },
  secondaryButton: { minHeight: 42, marginTop: 8, paddingHorizontal: 14, borderRadius:0, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 13, fontWeight: '800', color: colors.green },
  order: { paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  link: { fontSize: 12, fontWeight: '900', color: colors.green, padding: 6 },
});
