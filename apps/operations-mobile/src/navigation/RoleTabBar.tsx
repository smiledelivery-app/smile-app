import { AppText as Text } from '@makanza/mobile-ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { AppColors } from '../theme/colors';

export type VendorTab = 'overview' | 'orders' | 'products' | 'wallet' | 'account';
export type RiderTab = 'home' | 'offers' | 'deliveries' | 'wallet' | 'account';
type Tab = VendorTab | RiderTab;

const vendorTabs: { id: VendorTab; label: string; icon: 'home-outline' | 'receipt-outline' | 'cube-outline' | 'card-outline' | 'account-outline' }[] = [
  { id: 'overview', label: 'Overview', icon: 'home-outline' },
  { id: 'orders', label: 'Orders', icon: 'receipt-outline' },
  { id: 'products', label: 'Products', icon: 'cube-outline' },
  { id: 'wallet', label: 'Wallet', icon: 'card-outline' },
  { id: 'account', label: 'Account', icon: 'account-outline' },
];
const riderTabs: { id: RiderTab; label: string; icon: 'navigate-outline' | 'flash-outline' | 'receipt-outline' | 'card-outline' | 'account-outline' }[] = [
  { id: 'home', label: 'Go', icon: 'navigate-outline' },
  { id: 'offers', label: 'Offers', icon: 'flash-outline' },
  { id: 'deliveries', label: 'Deliveries', icon: 'receipt-outline' },
  { id: 'wallet', label: 'Wallet', icon: 'card-outline' },
  { id: 'account', label: 'Profile', icon: 'account-outline' },
];

export default function RoleTabBar({ role, active, onSelect, colors }: {
  role: 'VENDOR' | 'RIDER'; active: Tab; onSelect: (tab: Tab) => void; colors: AppColors;
}) {
  const tabs = role === 'VENDOR' ? vendorTabs : riderTabs;
  return <View style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.line }]}>
    {tabs.map(tab => {
      const selected = active === tab.id;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelect(tab.id)} style={styles.item}>
        <Ionicons name={tab.icon} size={25} color={selected ? colors.green : colors.muted}/>
        <Text style={[styles.label, { color: selected ? colors.green : colors.muted }, selected && styles.active]}>{tab.label}</Text>
        {selected && <View style={[styles.dot, { backgroundColor: colors.green }]} />}
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, flexDirection: 'row', borderTopWidth: 1, paddingBottom: 3 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '600' },
  active: { fontWeight: '900' },
  dot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius:0},
});
