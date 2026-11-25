import { AppText as Text, CancellationReasonModal, type CancellationReason } from '@makanza/mobile-ui';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { formatOrderNumber, type VendorOrder } from '@makanza/mobile-core';
import FormField from '../components/FormField';
import { Ionicons } from '../components/AppIcon';
import type { AppColors } from '../theme/colors';
import { vendorRadius, vendorSpace } from '../theme/vendor';
import { getVendorOrderProgressStep } from '../utils/vendor-orders';

type Props = {
  order: VendorOrder;
  busy: boolean;
  colors: AppColors;
  onAction: (id: string, status: string, reason?: string) => void;
  onVerifyPickup: (id: string, code: string) => void;
  onCancel: (id: string, reason: CancellationReason, details: string) => void;
};

type RejectionReason = 'NOT_AVAILABLE' | 'OUT_OF_STOCK';
type StatusStyle = { label: string; color: string; background: string; icon: string };

const PROGRESS_STEPS = ['Accepted', 'Preparing', 'Ready', 'Picked up'] as const;

const REJECTION_OPTIONS: ReadonlyArray<{ id: RejectionReason; title: string; detail: string }> = [
  { id: 'OUT_OF_STOCK', title: 'Out of stock', detail: 'One or more ordered items are sold out right now.' },
  { id: 'NOT_AVAILABLE', title: 'Item not available', detail: 'Your kitchen cannot fulfil this order at the moment.' },
];

export default function OrderCard({ order, busy, colors, onAction, onVerifyPickup, onCancel }: Props) {
  const [pickupCode, setPickupCode] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('OUT_OF_STOCK');

  const s = styles(colors);
  const next =
    order.status === 'CONFIRMED'
      ? (['Accept order', 'ACCEPTED_BY_VENDOR'] as const)
      : order.status === 'ACCEPTED_BY_VENDOR'
        ? (['Start preparing', 'PREPARING'] as const)
        : order.status === 'PREPARING'
          ? (['Ready for pickup', 'READY_FOR_PICKUP'] as const)
          : null;
  const status = statusStyle(order.status, colors);
  const progressStep = getVendorOrderProgressStep(order.status);
  const showProgress = ['ACCEPTED_BY_VENDOR', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'PICKED_UP'].includes(order.status);

  const items = order.items
    .map(
      line =>
        `${line.quantity} × ${line.nameSnapshot}${
          line.addons?.length
            ? ` (+ ${line.addons.map(extra => `${extra.quantity * line.quantity} ${extra.nameSnapshot}`).join(', ')})`
            : ''
        }`,
    )
    .join(' · ');
  const itemCount = order.items.reduce((count, line) => count + line.quantity, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.orderMark}>
            <Ionicons name="receipt-outline" size={18} color={colors.green} />
          </View>
          <View style={s.orderIdentity}>
            <Text style={s.orderLabel}>CUSTOMER ORDER</Text>
            <Text style={s.id}>{formatOrderNumber(order.displayNumber, order.id)}</Text>
            <Text style={s.date}>
              {new Date(order.createdAt).toLocaleString('en-NG', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[s.status, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={s.itemsPanel}>
        <Text style={s.itemsLabel}>
          {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
        </Text>
        <Text style={s.items}>{items}</Text>
      </View>

      {showProgress && progressStep > 0 && (
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
      )}

      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Your store payout (items)</Text>
        <Text style={s.total}>₦{((order.subtotalMinor ?? order.totalMinor) / 100).toLocaleString('en-NG')}</Text>
      </View>

      {order.status === 'READY_FOR_PICKUP' && (
        <View style={s.pickupPanel}>
          <View style={s.pickupHeading}>
            <View style={s.pickupIcon}>
              <Ionicons name="bicycle-outline" size={16} color={colors.green} />
            </View>
            <Text style={s.pickupLabel}>QUEUED FOR RIDER</Text>
          </View>
          <Text style={s.pickupCopy}>
            {order.delivery?.status === 'OFFERING'
              ? 'Order is ready and offered to nearby riders. Once a rider accepts, ask for their 6-digit pickup code.'
              : 'Order is queued and waiting for an available nearby rider.'}
          </Text>
        </View>
      )}

      {order.delivery?.status === 'ASSIGNED' && !order.delivery.pickupVerified && (
        <View style={s.pickupPanel}>
          <View style={s.pickupHeading}>
            <View style={s.pickupIcon}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.green} />
            </View>
            <Text style={s.pickupLabel}>VERIFY RIDER PICKUP</Text>
          </View>
          <Text style={s.pickupCopy}>
            {order.delivery.riderName
              ? `Assigned rider: ${order.delivery.riderName}. Ask them for their six-digit pickup code before handing over the order.`
              : 'Ask the rider to show their six-digit pickup code before handing over the order.'}
          </Text>
          <FormField
            label="Rider pickup code"
            value={pickupCode}
            onChangeText={value => setPickupCode(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            dark={colors.isDark}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => onVerifyPickup(order.id, pickupCode)}
            disabled={busy || pickupCode.length !== 6}
            style={[s.primaryButton, (busy || pickupCode.length !== 6) && s.disabled]}
          >
            <Text style={s.primaryText}>{busy ? 'Verifying…' : 'Verify pickup code'}</Text>
          </Pressable>
        </View>
      )}

      {order.delivery?.pickupVerified && (
        <View style={s.verified}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.green} />
          <Text style={s.verifiedText}>Pickup verified · rider can continue to the customer.</Text>
        </View>
      )}

      {next && (
        <View style={s.actions}>
          {order.status === 'CONFIRMED' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reject order ${formatOrderNumber(order.displayNumber, order.id)}`}
              onPress={() => setRejectOpen(true)}
              disabled={busy}
              style={[s.rejectButton, busy && s.disabled]}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.isDark ? '#f0877a' : '#a34232'} />
              <Text style={s.rejectText}>Reject</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => onAction(order.id, next[1])}
            disabled={busy}
            style={[s.primaryButton, busy && s.disabled]}
          >
            <Text style={s.primaryText}>{busy ? 'Updating…' : next[0]}</Text>
          </Pressable>
        </View>
      )}

      {['ACCEPTED_BY_VENDOR', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED'].includes(order.status) && (
        <Pressable accessibilityRole="button" onPress={() => setCancelOpen(true)} disabled={busy} style={s.cancelButton}>
          <Ionicons name="close" size={16} color={colors.isDark ? '#f0877a' : '#a34232'} />
          <Text style={s.cancelText}>Cancel order</Text>
        </Pressable>
      )}

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setRejectOpen(false)}>
          <Pressable style={s.modalSheet} onPress={event => event.stopPropagation()}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View style={s.modalCopy}>
                <Text style={s.modalEyebrow}>INCOMING ORDER</Text>
                <Text style={s.modalTitle}>Reject order</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close reject dialog" onPress={() => setRejectOpen(false)} style={s.modalClose}>
                <Ionicons name="close" size={19} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={s.modalSubtitle}>Choose why your kitchen cannot accept this order. The customer will be notified.</Text>
            <View style={s.reasonList}>
              {REJECTION_OPTIONS.map(option => {
                const selected = rejectReason === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setRejectReason(option.id)}
                    style={[s.reasonOption, selected && s.reasonOptionSelected]}
                  >
                    <View style={s.reasonCopy}>
                      <Text style={[s.reasonTitle, selected && s.reasonTitleSelected]}>{option.title}</Text>
                      <Text style={s.reasonDetail}>{option.detail}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle-outline" size={20} color={colors.green} />}
                  </Pressable>
                );
              })}
            </View>
            <View style={s.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setRejectOpen(false)} disabled={busy} style={s.secondaryButton}>
                <Text style={s.secondaryText}>Keep order</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setRejectOpen(false);
                  onAction(order.id, 'REJECTED', rejectReason);
                }}
                style={[s.confirmRejectButton, busy && s.disabled]}
              >
                <Text style={s.confirmRejectText}>{busy ? 'Rejecting…' : 'Confirm reject'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CancellationReasonModal
        visible={cancelOpen}
        role="VENDOR"
        dark={colors.isDark}
        busy={busy}
        onClose={() => setCancelOpen(false)}
        onSubmit={(reason, details) => {
          setCancelOpen(false);
          onCancel(order.id, reason, details);
        }}
      />
    </View>
  );
}

function statusStyle(status: string, colors: AppColors): StatusStyle {
  if (status === 'CONFIRMED') {
    return { label: 'Incoming', color: colors.green, background: colors.mint, icon: 'notifications-outline' };
  }
  if (status === 'ACCEPTED_BY_VENDOR') {
    return { label: 'Accepted', color: colors.green, background: colors.mint, icon: 'checkmark-circle-outline' };
  }
  if (status === 'PREPARING') {
    return { label: 'Preparing', color: colors.orange, background: colors.cream, icon: 'time-outline' };
  }
  if (status === 'READY_FOR_PICKUP') {
    return { label: 'Ready for pickup', color: colors.green, background: colors.mint, icon: 'checkmark-circle-outline' };
  }
  if (status === 'RIDER_ASSIGNED') {
    return { label: 'Rider assigned', color: colors.green, background: colors.mint, icon: 'bicycle-outline' };
  }
  if (status === 'PICKED_UP') {
    return { label: 'On the way', color: colors.green, background: colors.mint, icon: 'navigate-outline' };
  }
  if (status === 'DELIVERED') {
    return { label: 'Completed', color: colors.green, background: colors.mint, icon: 'checkmark-circle-outline' };
  }
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'REFUND_PENDING' || status === 'REFUNDED' || status === 'DELIVERY_EXCEPTION') {
    const label =
      status === 'REJECTED'
        ? 'Rejected'
        : status === 'CANCELLED'
          ? 'Cancelled'
          : status === 'REFUND_PENDING'
            ? 'Refund pending'
            : status === 'REFUNDED'
              ? 'Refunded'
              : 'Needs attention';
    return {
      label,
      color: colors.isDark ? '#f0877a' : '#a34232',
      background: colors.isDark ? '#392a20' : '#fdf0ed',
      icon: 'close',
    };
  }
  return {
    label: status.replaceAll('_', ' ').toLowerCase(),
    color: colors.muted,
    background: colors.cream,
    icon: 'information-circle-outline',
  };
}

const styles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      padding: vendorSpace.md,
      marginTop: vendorSpace.sm,
      gap: vendorSpace.md,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: vendorRadius.lg,
      backgroundColor: c.card,
      shadowColor: '#153a2b',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: vendorSpace.sm },
    headerLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    orderMark: {
      width: 40,
      height: 40,
      borderRadius: vendorRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.mint,
    },
    orderIdentity: { flex: 1, minWidth: 0 },
    orderLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1, color: c.muted },
    id: { fontSize: 15, fontWeight: '900', letterSpacing: -0.2, color: c.ink, marginTop: 2 },
    date: { fontSize: 10, color: c.muted, marginTop: 3 },
    statusBadge: {
      minHeight: 30,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: vendorRadius.pill,
    },
    status: { fontSize: 9, fontWeight: '900' },
    itemsPanel: { padding: 12, borderRadius: vendorRadius.md, backgroundColor: c.paper },
    itemsLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1, color: c.muted, marginBottom: 5 },
    items: { fontSize: 12, lineHeight: 19, fontWeight: '600', color: c.ink },
    progressTrack: { flexDirection: 'row', gap: 6 },
    progressSegment: { flex: 1, gap: 4 },
    progressBar: { height: 4, borderRadius: 2, backgroundColor: c.line },
    progressBarActive: { backgroundColor: c.green },
    progressLabel: { fontSize: 9, fontWeight: '700', color: c.muted, textAlign: 'center' },
    progressLabelActive: { color: c.green, fontWeight: '900' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: 11, fontWeight: '700', color: c.muted },
    total: { fontSize: 15, fontWeight: '900', color: c.green },
    pickupPanel: {
      padding: 12,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: vendorRadius.md,
      backgroundColor: c.cream,
    },
    pickupHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pickupIcon: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: vendorRadius.sm,
      backgroundColor: c.card,
    },
    pickupLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: c.green },
    pickupCopy: { fontSize: 10, lineHeight: 15, color: c.muted, marginTop: 6 },
    verified: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: vendorRadius.sm, backgroundColor: c.mint },
    verifiedText: { flex: 1, fontSize: 10, fontWeight: '700', color: c.green },
    actions: { flexDirection: 'row', gap: 8 },
    primaryButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderRadius: vendorRadius.sm,
      backgroundColor: c.green,
    },
    primaryText: { fontSize: 11, fontWeight: '900', color: 'white', textAlign: 'center' },
    rejectButton: {
      minHeight: 44,
      minWidth: 96,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: c.isDark ? '#58332d' : '#f1d8d2',
      borderRadius: vendorRadius.sm,
      backgroundColor: c.isDark ? '#241b19' : '#fff8f6',
    },
    rejectText: { fontSize: 11, fontWeight: '900', color: c.isDark ? '#f0877a' : '#a34232' },
    secondaryButton: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: vendorRadius.sm,
      backgroundColor: c.card,
    },
    secondaryText: { fontSize: 11, fontWeight: '800', color: c.ink },
    cancelButton: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 11,
      borderRadius: vendorRadius.sm,
      backgroundColor: c.isDark ? '#392a20' : '#fdf0ed',
    },
    cancelText: { fontSize: 10, fontWeight: '800', color: c.isDark ? '#f0877a' : '#a34232' },
    disabled: { opacity: 0.5 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.48)' },
    modalSheet: {
      paddingHorizontal: vendorSpace.lg,
      paddingTop: vendorSpace.sm,
      paddingBottom: vendorSpace.xl,
      borderTopLeftRadius: vendorRadius.xl,
      borderTopRightRadius: vendorRadius.xl,
      backgroundColor: c.paper,
    },
    modalHandle: {
      width: 38,
      height: 4,
      alignSelf: 'center',
      marginBottom: vendorSpace.md,
      borderRadius: vendorRadius.pill,
      backgroundColor: c.line,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    modalCopy: { flex: 1 },
    modalEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: c.green },
    modalTitle: { fontSize: 20, fontWeight: '900', color: c.ink, marginTop: 3 },
    modalClose: {
      width: 38,
      height: 38,
      borderRadius: vendorRadius.pill,
      borderWidth: 1,
      borderColor: c.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
    },
    modalSubtitle: { fontSize: 12, lineHeight: 18, color: c.muted, marginTop: 6, marginBottom: vendorSpace.md },
    reasonList: { gap: 9 },
    reasonOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 13,
      borderRadius: vendorRadius.md,
      borderWidth: 1,
      borderColor: c.line,
      backgroundColor: c.card,
    },
    reasonOptionSelected: { borderColor: c.green, backgroundColor: c.mint },
    reasonCopy: { flex: 1 },
    reasonTitle: { fontSize: 13, fontWeight: '900', color: c.ink },
    reasonTitleSelected: { color: c.green },
    reasonDetail: { fontSize: 11, lineHeight: 16, color: c.muted, marginTop: 2 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: vendorSpace.lg },
    confirmRejectButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: vendorRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#a34232',
    },
    confirmRejectText: { fontSize: 11, fontWeight: '900', color: 'white' },
  });
