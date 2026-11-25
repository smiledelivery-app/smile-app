import { AppText as Text, CancellationReasonModal, type CancellationReason } from '@makanza/mobile-ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CustomerOrder } from '@makanza/mobile-core';
import { Ionicons } from '../components/AppIcon';
import { BackHeader } from '../components/ui';
import { darkColors, lightColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import { formatOrderNumber } from '../utils/format';
import {
  canCancelCustomerOrder,
  filterHistoryOrders,
  filterOrdersByTab,
  formatCustomerOrderStatus,
  getOrderProgressStep,
  getOrderTabCounts,
  isOrderCancelled,
  isOrderCompleted,
  isOrderOngoing,
  isOrderUnpaidOrFailed,
  type HistoryFilter,
  type OrderTab,
} from '../utils/orders';

type Props = {
  orders: CustomerOrder[];
  loading: boolean;
  error: string;
  hasAccount: boolean;
  dark: boolean;
  onRetry: () => void;
  onSignIn: () => void;
  onOpen: (order: CustomerOrder) => void;
  onCancel: (orderId: string, reason: CancellationReason, details: string) => void;
  onPayOrder: (order: CustomerOrder) => void;
};

const ORDER_TABS: ReadonlyArray<{ id: OrderTab; label: string }> = [
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const HISTORY_FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All initiated' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'unpaid', label: 'Unpaid / Failed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PROGRESS_STEPS = ['Paid', 'Preparing', 'Rider', 'On way'] as const;

const itemCount = (order: CustomerOrder) => order.items.reduce((total, item) => total + item.quantity, 0);
const money = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG')}`;
const formatOrderDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function statusTone(order: CustomerOrder) {
  if (order.status === 'PENDING_PAYMENT') return 'warning' as const;
  if (order.status === 'PAYMENT_FAILED' || order.status === 'DELIVERY_EXCEPTION' || isOrderCancelled(order)) {
    return 'danger' as const;
  }
  return 'primary' as const;
}

function emptyCopy(tab: OrderTab) {
  if (tab === 'ongoing') {
    return {
      icon: 'bike-fast' as const,
      title: 'No ongoing orders',
      body: 'Only orders with a confirmed payment that are still on the way appear here.',
    };
  }
  if (tab === 'completed') {
    return {
      icon: 'check-decagram-outline' as const,
      title: 'No completed orders yet',
      body: 'Orders that have been delivered to you will appear here.',
    };
  }
  return {
    icon: 'close-circle-outline' as const,
    title: 'No cancelled orders',
    body: 'Cancelled, rejected, or refunded orders will appear here.',
  };
}

export default function OrdersScreen({
  orders,
  loading,
  error,
  hasAccount,
  dark,
  onRetry,
  onSignIn,
  onOpen,
  onCancel,
  onPayOrder,
}: Props) {
  const [activeTab, setActiveTab] = useState<OrderTab>('ongoing');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);

  const colors = dark ? darkColors : lightColors;
  const c = customerPalette(colors);
  const s = styles(c);

  const tabCounts = useMemo(() => getOrderTabCounts(orders), [orders]);
  const visibleOrders = useMemo(() => filterOrdersByTab(orders, activeTab), [orders, activeTab]);
  const historyOrders = useMemo(() => filterHistoryOrders(orders, historyFilter), [orders, historyFilter]);
  const unpaidCount = useMemo(() => orders.filter(isOrderUnpaidOrFailed).length, [orders]);
  const cancelTarget = useMemo(() => orders.find(order => order.id === cancelOrderId) ?? null, [orders, cancelOrderId]);

  const openHistory = () => {
    setHistoryFilter('all');
    setHistoryOpen(true);
  };

  const renderOrderCard = (order: CustomerOrder, fromHistory = false) => {
    const tone = statusTone(order);
    const paymentDue = order.status === 'PENDING_PAYMENT';
    const paymentFailed = order.status === 'PAYMENT_FAILED';
    const paymentRetryable = paymentDue || paymentFailed;
    const ongoing = isOrderOngoing(order);
    const completed = isOrderCompleted(order);
    const statusLabel = formatCustomerOrderStatus(order);
    const progressStep = getOrderProgressStep(order.status);
    const canCancel = canCancelCustomerOrder(order);

    const ctaLabel = paymentDue
      ? 'Complete payment'
      : paymentFailed
        ? 'Retry payment'
        : ongoing
          ? 'Track delivery'
          : completed
            ? 'View receipt'
            : 'View details';

    const handlePrimaryPress = () => {
      if (fromHistory) setHistoryOpen(false);
      if (paymentRetryable) onPayOrder(order);
      else onOpen(order);
    };

    return (
      <View key={order.id} style={s.orderWrap}>
        <View style={s.orderCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${order.vendor?.name ?? 'Kitchen order'}, ${statusLabel}`}
            accessibilityHint={
              paymentDue
                ? 'Opens payment options for this order.'
                : ongoing
                  ? 'Opens live delivery tracking.'
                  : 'Opens order details and receipt.'
            }
            onPress={handlePrimaryPress}
            style={({ pressed }) => [s.orderMain, pressed && s.pressed]}
          >
            <View style={s.cardTop}>
              <View style={[s.vendorMark, tone === 'danger' && s.vendorMarkDanger, tone === 'warning' && s.vendorMarkWarning]}>
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={tone === 'danger' ? c.danger : tone === 'warning' ? c.warning : c.primary}
                />
              </View>
              <View style={s.vendorCopy}>
                <Text numberOfLines={1} style={s.vendor}>
                  {order.vendor?.name ?? 'Kitchen order'}
                </Text>
                <Text style={s.orderId}>ORDER {formatOrderNumber(order.displayNumber, order.id).replace('#', '')}</Text>
              </View>
              <View
                style={[
                  s.statusPill,
                  tone === 'danger' && s.statusDanger,
                  tone === 'warning' && s.statusWarning,
                ]}
              >
                <View
                  style={[
                    s.statusDot,
                    tone === 'danger' && s.dotDanger,
                    tone === 'warning' && s.dotWarning,
                  ]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    s.statusText,
                    tone === 'danger' && s.statusTextDanger,
                    tone === 'warning' && s.statusTextWarning,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            <Text numberOfLines={2} style={s.items}>
              {order.items.map(item => `${item.quantity} × ${item.nameSnapshot}`).join(' · ')}
            </Text>

            {ongoing && progressStep > 0 && (
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  {PROGRESS_STEPS.map((label, index) => {
                    const reached = index + 1 <= progressStep;
                    return (
                      <View key={label} style={s.progressSegment}>
                        <View style={[s.progressBar, reached && s.progressBarActive]} />
                        <Text style={[s.progressLabel, reached && s.progressLabelActive]}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={s.cardBottom}>
              <Text style={s.meta}>
                {formatOrderDate(order.createdAt)} · {itemCount(order)} {itemCount(order) === 1 ? 'item' : 'items'}
              </Text>
              <Text style={s.price}>{money(order.totalMinor)}</Text>
            </View>

            {paymentDue && (
              <Text style={s.paymentHint}>Payment has not been completed. Complete payment to send this order to the kitchen.</Text>
            )}
            {paymentFailed && (
              <Text style={s.failedHint}>Payment was not completed for this initiated order.</Text>
            )}

            <View style={[s.trackAction, paymentDue && s.trackActionPending]}>
              <Text style={[s.trackText, paymentDue && s.trackTextPending]}>{ctaLabel}</Text>
              <Ionicons name="arrow-forward" size={17} color={paymentDue ? 'white' : c.primary} />
            </View>
          </Pressable>

          {canCancel && (ongoing || fromHistory) && (
            <View style={s.cardFooter}>
              <Text style={s.footerLabel}>{paymentDue ? 'No longer want this order?' : 'Need to change your plans?'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel order from ${order.vendor?.name ?? 'kitchen'}`}
                onPress={() => setCancelOrderId(order.id)}
                style={({ pressed }) => [s.cancelAction, pressed && s.pressed]}
              >
                <Ionicons name="close-circle-outline" size={15} color={c.danger} />
                <Text style={s.cancelText}>Cancel order</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  const empty = emptyCopy(activeTab);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Ionicons name="receipt-outline" size={20} color={c.primary} />
          </View>
          <View style={s.headerCopy}>
            <Text style={s.headerTitle}>Your orders</Text>
            <Text numberOfLines={1} style={s.headerSubtitle}>
              {hasAccount && orders.length
                ? `${tabCounts.ongoing} ongoing · ${orders.length} initiated`
                : 'Track paid deliveries and past orders'}
            </Text>
          </View>
        </View>
        <View style={s.headerActions}>
          {hasAccount && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh orders"
              disabled={loading}
              onPress={onRetry}
              style={({ pressed }) => [s.headerActionButton, pressed && s.pressed]}
            >
              {loading ? <ActivityIndicator size="small" color={c.primary} /> : <Ionicons name="refresh-outline" size={20} color={c.primary} />}
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Order history"
            accessibilityHint="Shows all orders you have ever initiated"
            onPress={openHistory}
            style={({ pressed }) => [s.headerActionButton, s.historyActionButton, pressed && s.pressed]}
          >
            <MaterialCommunityIcons name="history" size={21} color={c.primary} />
            {hasAccount && unpaidCount > 0 && <View style={s.historyBadgeDot} />}
          </Pressable>
        </View>
      </View>

      <View style={s.content}>
        <View style={s.segment} accessibilityRole="tablist">
          {ORDER_TABS.map(tab => {
            const selected = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.id)}
                style={[s.segmentItem, selected && s.segmentActive]}
              >
                <Text numberOfLines={1} style={[s.segmentText, selected && s.segmentTextActive]}>
                  {tab.label}
                </Text>
                {hasAccount && count > 0 && (
                  <View style={[s.segmentCount, selected && s.segmentCountActive]}>
                    <Text style={[s.segmentCountText, selected && s.segmentCountTextActive]}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {!hasAccount ? (
          <View style={s.state}>
            <View style={s.stateIcon}>
              <Ionicons name="receipt-outline" size={24} color={c.primary} />
            </View>
            <Text style={s.stateTitle}>Your orders live here</Text>
            <Text style={s.stateCopy}>Sign in to follow paid deliveries, completed receipts, and cancelled orders.</Text>
            <Pressable accessibilityRole="button" onPress={onSignIn} style={s.primary}>
              <Text style={s.primaryText}>Sign in</Text>
            </Pressable>
          </View>
        ) : loading && !orders.length ? (
          <ActivityIndicator color={c.primary} style={s.loader} />
        ) : error && !orders.length ? (
          <View style={s.state}>
            <View style={[s.stateIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="alert-circle-outline" size={24} color={c.danger} />
            </View>
            <Text style={s.stateTitle}>Orders couldn’t load</Text>
            <Text style={s.stateCopy}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={s.primary}>
              <Text style={s.primaryText}>Try again</Text>
            </Pressable>
          </View>
        ) : visibleOrders.length === 0 ? (
          <View style={s.emptyState}>
            <View accessibilityRole="image" accessibilityLabel={empty.title} style={s.emptyIllustration}>
              <MaterialCommunityIcons name={empty.icon} size={42} color="white" />
            </View>
            <Text style={s.emptyTitle}>{empty.title}</Text>
            <Text style={s.stateCopy}>{empty.body}</Text>
            {orders.length > 0 && (
              <Pressable accessibilityRole="button" onPress={openHistory} style={s.secondaryButton}>
                <MaterialCommunityIcons name="history" size={17} color={c.primary} />
                <Text style={s.secondaryButtonText}>View all initiated orders ({orders.length})</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {error ? (
              <Pressable accessibilityRole="button" onPress={onRetry} style={s.warning}>
                <Text style={s.warningText}>Couldn’t refresh. Showing your last update.</Text>
                <Text style={s.warningAction}>Retry</Text>
              </Pressable>
            ) : null}

            <View style={s.listHeading}>
              <View>
                <Text style={s.listTitle}>
                  {activeTab === 'ongoing'
                    ? 'PAID & IN PROGRESS'
                    : activeTab === 'completed'
                      ? 'DELIVERED ORDERS'
                      : 'CANCELLED ORDERS'}
                </Text>
                <Text style={s.listSubtitle}>
                  {visibleOrders.length} {visibleOrders.length === 1 ? 'order' : 'orders'}
                  {activeTab === 'ongoing' ? ' · updated automatically' : ''}
                </Text>
              </View>
              <View style={s.countBadge}>
                <Ionicons
                  name={activeTab === 'ongoing' ? 'radio-button-on' : activeTab === 'completed' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                  size={13}
                  color={c.primary}
                />
                <Text style={s.countText}>{visibleOrders.length}</Text>
              </View>
            </View>

            <ScrollView
              style={s.list}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={onRetry} tintColor={c.primary} />}
            >
              {visibleOrders.map(order => renderOrderCard(order, false))}
            </ScrollView>
          </>
        )}
      </View>

      <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <SafeAreaView style={s.historySafe}>
          <BackHeader
            title="Order history"
            subtitle="All orders you’ve ever initiated"
            colors={colors}
            onBack={() => setHistoryOpen(false)}
          />
          <View style={s.historyBody}>
            {!hasAccount ? (
              <View style={s.state}>
                <View style={s.stateIcon}>
                  <MaterialCommunityIcons name="history" size={24} color={c.primary} />
                </View>
                <Text style={s.stateTitle}>Sign in to view history</Text>
                <Text style={s.stateCopy}>Every order you initiate is recorded in your Smile account.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setHistoryOpen(false);
                    onSignIn();
                  }}
                  style={s.primary}
                >
                  <Text style={s.primaryText}>Sign in</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={s.historyBanner}>
                  <View style={s.historyBannerIcon}>
                    <MaterialCommunityIcons name="history" size={20} color={c.primary} />
                  </View>
                  <View style={s.historyBannerCopy}>
                    <Text style={s.historyBannerTitle}>
                      {orders.length} {orders.length === 1 ? 'initiated order' : 'initiated orders'}
                    </Text>
                    <Text style={s.historyBannerText}>
                      Includes unpaid checkouts, failed payments, ongoing deliveries, completed, and cancelled orders.
                    </Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.filterBar}
                  contentContainerStyle={s.filterBarContent}
                >
                  {HISTORY_FILTERS.map(chip => {
                    const selected = historyFilter === chip.id;
                    return (
                      <Pressable
                        key={chip.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setHistoryFilter(chip.id)}
                        style={[s.filterChip, selected && s.filterChipActive]}
                      >
                        <Text style={[s.filterChipText, selected && s.filterChipTextActive]}>{chip.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {historyOrders.length === 0 ? (
                  <View style={s.emptyState}>
                    <View style={s.emptyIllustration}>
                      <MaterialCommunityIcons name="history" size={40} color="white" />
                    </View>
                    <Text style={s.emptyTitle}>
                      {orders.length === 0 ? 'No orders initiated yet' : 'No matching orders'}
                    </Text>
                    <Text style={s.stateCopy}>
                      {orders.length === 0
                        ? 'Every order you start — whether paid, pending payment, failed, delivered, or cancelled — will appear here.'
                        : 'Try another filter to inspect the rest of your initiated orders.'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={s.list}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={onRetry} tintColor={c.primary} />}
                  >
                    {historyOrders.map(order => renderOrderCard(order, true))}
                  </ScrollView>
                )}
              </>
            )}
          </View>
          <CancellationReasonModal
            visible={Boolean(cancelTarget && historyOpen)}
            role="CUSTOMER"
            dark={dark}
            onClose={() => setCancelOrderId(null)}
            onSubmit={(reason, details) => {
              if (!cancelTarget) return;
              setCancelOrderId(null);
              onCancel(cancelTarget.id, reason, details);
            }}
          />
        </SafeAreaView>
      </Modal>

      <CancellationReasonModal
        visible={Boolean(cancelTarget && !historyOpen)}
        role="CUSTOMER"
        dark={dark}
        onClose={() => setCancelOrderId(null)}
        onSubmit={(reason, details) => {
          if (!cancelTarget) return;
          setCancelOrderId(null);
          onCancel(cancelTarget.id, reason, details);
        }}
      />
    </View>
  );
}

const styles = (c: ReturnType<typeof customerPalette>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.canvas },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: customerSpace.lg,
      paddingVertical: customerSpace.md,
      backgroundColor: c.canvas,
    },
    headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerIcon: {
      width: 42,
      height: 42,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    headerTitle: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.7, color: c.ink },
    headerSubtitle: { fontSize: 12, lineHeight: 16, color: c.muted, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerActionButton: {
      position: 'relative',
      width: 42,
      height: 42,
      borderRadius: customerRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    historyActionButton: { backgroundColor: c.primarySoft, borderColor: c.primarySoft },
    historyBadgeDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.warning,
      borderWidth: 1.5,
      borderColor: c.surface,
    },
    content: { flex: 1, paddingHorizontal: customerSpace.lg, paddingBottom: customerSpace.md },
    segment: {
      minHeight: 48,
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: customerRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    segmentItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 6,
      borderRadius: customerRadius.sm,
    },
    segmentActive: {
      backgroundColor: c.surface,
      shadowColor: '#173323',
      shadowOpacity: 0.08,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    segmentText: { fontSize: 12, fontWeight: '700', color: c.muted },
    segmentTextActive: { color: c.primary, fontWeight: '900' },
    segmentCount: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.border,
    },
    segmentCountActive: { backgroundColor: c.primarySoft },
    segmentCountText: { fontSize: 10, fontWeight: '800', color: c.muted },
    segmentCountTextActive: { color: c.primary },
    listHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: customerSpace.md,
      marginBottom: customerSpace.xs,
    },
    listTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: c.ink },
    listSubtitle: { fontSize: 10, color: c.muted, marginTop: 3 },
    countBadge: {
      minWidth: 36,
      height: 30,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 8,
      borderRadius: customerRadius.pill,
      backgroundColor: c.primarySoft,
    },
    countText: { fontSize: 11, fontWeight: '900', color: c.primary },
    list: { flex: 1, marginTop: customerSpace.xs },
    listContent: { paddingBottom: customerSpace.xxl },
    orderWrap: { marginTop: 11 },
    orderCard: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: customerRadius.lg,
      backgroundColor: c.surface,
      shadowColor: '#173323',
      shadowOpacity: 0.06,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    orderMain: { padding: 15, backgroundColor: c.surface },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    vendorMark: {
      width: 42,
      height: 42,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    vendorMarkDanger: { backgroundColor: c.accentSoft },
    vendorMarkWarning: { backgroundColor: c.accentSoft },
    vendorCopy: { flex: 1, minWidth: 0 },
    vendor: { fontSize: 14, fontWeight: '900', color: c.ink },
    orderId: { fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8, color: c.muted, marginTop: 3 },
    statusPill: {
      maxWidth: '50%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: customerRadius.pill,
      backgroundColor: c.primarySoft,
    },
    statusDanger: { backgroundColor: c.accentSoft },
    statusWarning: { backgroundColor: c.accentSoft },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary },
    dotDanger: { backgroundColor: c.danger },
    dotWarning: { backgroundColor: c.warning },
    statusText: { fontSize: 9, fontWeight: '900', color: c.primary, flexShrink: 1 },
    statusTextDanger: { color: c.danger },
    statusTextWarning: { color: c.warning },
    items: { fontSize: 12, lineHeight: 18, color: c.ink, marginTop: 13 },
    progressWrap: { marginTop: 13 },
    progressTrack: { flexDirection: 'row', gap: 6 },
    progressSegment: { flex: 1, gap: 4 },
    progressBar: { height: 4, borderRadius: 2, backgroundColor: c.border },
    progressBarActive: { backgroundColor: c.primary },
    progressLabel: { fontSize: 9, fontWeight: '700', color: c.muted, textAlign: 'center' },
    progressLabelActive: { color: c.primary, fontWeight: '900' },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 },
    meta: { fontSize: 10, color: c.muted },
    price: { fontSize: 15, fontWeight: '900', color: c.ink },
    paymentHint: { fontSize: 10, lineHeight: 15, color: c.warning, marginTop: 10 },
    failedHint: { fontSize: 10, lineHeight: 15, color: c.danger, marginTop: 10 },
    trackAction: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      marginTop: 12,
      borderRadius: customerRadius.sm,
      backgroundColor: c.primarySoft,
    },
    trackActionPending: { backgroundColor: c.primary },
    trackText: { fontSize: 11, fontWeight: '900', color: c.primary },
    trackTextPending: { color: 'white' },
    cardFooter: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 15,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    footerLabel: { fontSize: 10, color: c.muted },
    cancelAction: {
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: customerRadius.pill,
      backgroundColor: c.accentSoft,
    },
    cancelText: { fontSize: 10, fontWeight: '900', color: c.danger },
    warning: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingHorizontal: 12,
      marginTop: 10,
      borderRadius: customerRadius.sm,
      backgroundColor: c.accentSoft,
    },
    warningText: { flex: 1, fontSize: 10, lineHeight: 15, color: c.danger },
    warningAction: { fontSize: 10, fontWeight: '900', color: c.danger },
    state: {
      alignItems: 'center',
      padding: 24,
      marginTop: customerSpace.xl,
      borderRadius: customerRadius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    stateIcon: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: customerRadius.md,
      backgroundColor: c.primarySoft,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: customerSpace.xxl,
    },
    emptyIllustration: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: customerRadius.xl,
      backgroundColor: c.primary,
    },
    emptyTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4, color: c.ink, marginTop: 16, textAlign: 'center' },
    stateTitle: { fontSize: 15, fontWeight: '800', color: c.ink, marginTop: 12, textAlign: 'center' },
    stateCopy: { fontSize: 11, lineHeight: 17, color: c.muted, textAlign: 'center', marginTop: 5, maxWidth: 290 },
    primary: {
      minHeight: 43,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: customerRadius.sm,
      backgroundColor: c.primary,
      marginTop: 14,
    },
    primaryText: { fontSize: 11, fontWeight: '900', color: 'white' },
    secondaryButton: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 16,
      marginTop: 16,
      borderRadius: customerRadius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    secondaryButtonText: { fontSize: 11, fontWeight: '800', color: c.primary },
    historySafe: { flex: 1, backgroundColor: c.canvas },
    historyBody: { flex: 1, paddingHorizontal: customerSpace.lg, paddingTop: customerSpace.sm, paddingBottom: customerSpace.md },
    historyBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      padding: 13,
      borderRadius: customerRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    historyBannerIcon: {
      width: 38,
      height: 38,
      borderRadius: customerRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    historyBannerCopy: { flex: 1, minWidth: 0 },
    historyBannerTitle: { fontSize: 13, fontWeight: '900', color: c.ink },
    historyBannerText: { fontSize: 11, lineHeight: 16, color: c.muted, marginTop: 2 },
    filterBar: { flexGrow: 0, marginTop: 12, marginBottom: 4 },
    filterBarContent: { gap: 8, paddingRight: 8 },
    filterChip: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: customerRadius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText: { fontSize: 11, fontWeight: '800', color: c.muted },
    filterChipTextActive: { color: 'white' },
    loader: { margin: 30 },
    pressed: { opacity: 0.82 },
  });
