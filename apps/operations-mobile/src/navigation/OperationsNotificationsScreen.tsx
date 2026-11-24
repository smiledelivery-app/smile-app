import { AppText as Text } from '@makanza/mobile-ui';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { formatOrderNumber, type NotificationInboxItem } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { vendorRadius, vendorSpace } from '../theme/vendor';

export type OperationsNotification = NotificationInboxItem;
type DateGroup = 'today' | 'yesterday' | 'older';

function groupNotifications(items: OperationsNotification[]) {
  const today: OperationsNotification[] = [];
  const yesterday: OperationsNotification[] = [];
  const older: OperationsNotification[] = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  for (const item of items) {
    const itemTime = new Date(item.createdAt).getTime();
    if (Number.isNaN(itemTime)) {
      older.push(item);
    } else if (itemTime >= startOfToday) {
      today.push(item);
    } else if (itemTime >= startOfYesterday) {
      yesterday.push(item);
    } else {
      older.push(item);
    }
  }

  return { today, yesterday, older };
}

function formatNotificationTime(value: string, group: DateGroup): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (group === 'today') {
    return date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (group === 'yesterday') {
    return `Yesterday, ${date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getNotificationMeta(item: OperationsNotification, role: 'Vendor' | 'Rider', c: AppColors) {
  const isDark = c.isDark;
  const type = item.type;

  if (type === 'RIDER_OFFER') {
    return {
      icon: 'flash-outline',
      kicker: 'DELIVERY OFFER',
      iconBg: isDark ? '#3d2e14' : '#fef4e2',
      iconColor: isDark ? '#f4d57c' : '#b07412',
    };
  }
  if (type === 'ORDER_CONFIRMED') {
    return {
      icon: 'receipt-outline',
      kicker: role === 'Vendor' ? 'NEW ORDER' : 'ORDER PLACED',
      iconBg: isDark ? '#1a3326' : '#eaf6ee',
      iconColor: isDark ? '#7dd4a5' : '#176b4d',
    };
  }
  if (type.includes('CANCELLED')) {
    return {
      icon: 'alert-circle-outline',
      kicker: 'ORDER CANCELLED',
      iconBg: isDark ? '#381c1c' : '#fdeded',
      iconColor: isDark ? '#f28b82' : '#c53929',
    };
  }
  if (type.includes('PICKED_UP')) {
    return {
      icon: 'bicycle-outline',
      kicker: 'DISPATCH PICKUP',
      iconBg: isDark ? '#172c33' : '#e8f5f7',
      iconColor: isDark ? '#80d4e0' : '#237a87',
    };
  }
  if (type.includes('RIDER_ASSIGNED')) {
    return {
      icon: 'bicycle-outline',
      kicker: role === 'Rider' ? 'DELIVERY ASSIGNED' : 'RIDER ON THE WAY',
      iconBg: isDark ? '#1a3326' : '#eaf6ee',
      iconColor: isDark ? '#7dd4a5' : '#176b4d',
    };
  }
  if (type.includes('DELIVERED')) {
    return {
      icon: 'checkmark-circle-outline',
      kicker: 'DELIVERY COMPLETE',
      iconBg: isDark ? '#163322' : '#e9f7ee',
      iconColor: isDark ? '#62c892' : '#1e7e4c',
    };
  }
  if (type === 'ADMIN_BROADCAST') {
    return {
      icon: 'megaphone-outline',
      kicker: 'SYSTEM ANNOUNCEMENT',
      iconBg: isDark ? '#262238' : '#f0effd',
      iconColor: isDark ? '#a89df2' : '#5b4bc4',
    };
  }
  return {
    icon: 'notifications-outline',
    kicker: 'ACTIVITY',
    iconBg: isDark ? '#1b2a23' : c.mint,
    iconColor: c.green,
  };
}

function NotificationCard({
  item,
  role,
  group,
  colors: c,
  onPress,
}: {
  item: OperationsNotification;
  role: 'Vendor' | 'Rider';
  group: DateGroup;
  colors: AppColors;
  onPress: () => void;
}) {
  const rider = role === 'Rider';
  const isUnread = !item.readAt;
  const meta = getNotificationMeta(item, role, c);
  const orderRef = item.orderId ? formatOrderNumber(item.displayNumber, item.orderId) : null;
  const timeText = formatNotificationTime(item.createdAt, group);
  const s = cardStyles(c);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? 'Unread: ' : ''}${item.title}. ${item.body}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        rider && s.riderCard,
        isUnread && (rider ? s.riderUnread : s.vendorUnread),
        pressed && s.pressed,
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: meta.iconBg }]}>
        <Ionicons name={meta.icon} size={20} color={meta.iconColor} />
      </View>
      <View style={s.copy}>
        <View style={s.topRow}>
          <View style={s.kickerRow}>
            <Text style={[s.kicker, { color: meta.iconColor }]}>{meta.kicker}</Text>
            {isUnread && <View style={s.unreadDot} />}
          </View>
          <Text style={s.time}>{timeText}</Text>
        </View>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.body}>{item.body}</Text>
        {orderRef ? (
          <View style={s.footerRow}>
            <View style={s.orderBadge}>
              <Ionicons name="receipt-outline" size={12} color={c.muted} />
              <Text style={s.orderBadgeText}>{orderRef}</Text>
            </View>
            <View style={s.actionLink}>
              <Text style={s.actionLinkText}>View</Text>
              <Ionicons name="chevron-forward" size={13} color={c.green} />
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function OperationsNotificationsScreen({
  role,
  items,
  unreadCount,
  loading,
  error,
  colors: c,
  onBack,
  onRefresh,
  onReadAll,
  onOpen,
}: {
  role: 'Vendor' | 'Rider';
  items: OperationsNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  colors: AppColors;
  onBack: () => void;
  onRefresh: () => void;
  onReadAll: () => void;
  onOpen: (item: OperationsNotification) => void;
}) {
  const rider = role === 'Rider';
  const s = screenStyles(c);

  const { today, yesterday, older } = useMemo(() => groupNotifications(items), [items]);

  const sections = useMemo(() => [
    { key: 'today' as const, title: 'Today', items: today },
    { key: 'yesterday' as const, title: 'Yesterday', items: yesterday },
    { key: 'older' as const, title: 'Older', items: older },
  ].filter(section => section.items.length > 0), [today, yesterday, older]);

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, rider && s.riderHeader]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={s.headerButton}>
          <Ionicons name="chevron-back" size={21} color={c.ink} />
        </Pressable>
        <View style={s.headerTitleWrap}>
          <Text style={s.eyebrow}>{rider ? 'RIDER DISPATCH' : 'STORE OPERATIONS'}</Text>
          <Text style={[s.title, rider && s.riderTitle]}>Notifications</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" onPress={onRefresh} style={s.headerButton}>
          <Ionicons name="refresh-outline" size={20} color={c.green} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, rider && s.riderContent]} keyboardShouldPersistTaps="handled">
        {/* Hero Banner */}
        <View style={[s.hero, rider && s.riderHero]}>
          <View style={s.heroOrb1} />
          <View style={s.heroOrb2} />
          <View style={s.heroTop}>
            <View style={s.heroIconBox}>
              <Ionicons name={rider ? 'bicycle-outline' : 'storefront-outline'} size={24} color="#ffffff" />
            </View>
            <View style={s.heroStatusPill}>
              {unreadCount > 0 ? (
                <>
                  <View style={s.heroPulseDot} />
                  <Text style={s.heroStatusText}>{unreadCount} unread</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark" size={13} color="#ffffff" />
                  <Text style={s.heroStatusText}>All caught up</Text>
                </>
              )}
            </View>
          </View>
          <Text style={s.heroTitle}>{rider ? 'Delivery & Offer Alerts' : 'Store Operations'}</Text>
          <Text style={s.heroBody}>
            {rider
              ? 'Real-time updates on nearby delivery offers, pickup alerts, and drop-offs.'
              : 'Incoming orders, kitchen progress, and rider dispatch updates in one place.'}
          </Text>

          {unreadCount > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              onPress={onReadAll}
              style={({ pressed }) => [s.markAllAction, pressed && s.pressed]}
            >
              <Ionicons name="checkmark-done-outline" size={16} color="#ffffff" />
              <Text style={s.markAllActionText}>Mark all as read</Text>
            </Pressable>
          )}
        </View>

        {/* Loading State */}
        {loading && !items.length ? (
          <View style={s.stateBox}>
            <ActivityIndicator color={c.green} size="large" />
            <Text style={s.stateBody}>Checking for updates…</Text>
          </View>
        ) : error && !items.length ? (
          /* Error State */
          <View style={[s.stateBox, rider && s.riderStateBox]}>
            <View style={s.errorIcon}>
              <Ionicons name="alert-circle-outline" size={28} color="#c53929" />
            </View>
            <Text style={s.stateTitle}>Couldn’t load notifications</Text>
            <Text style={s.stateBody}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={onRefresh} style={s.retryButton}>
              <Text style={s.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : !items.length ? (
          /* Empty State */
          <View style={[s.stateBox, rider && s.riderStateBox]}>
            <View style={s.emptyIconBox}>
              <Ionicons name="notifications-outline" size={28} color={c.green} />
            </View>
            <Text style={s.stateTitle}>You’re all caught up</Text>
            <Text style={s.stateBody}>
              {rider
                ? 'New delivery offers and drop-off updates will appear here.'
                : 'New incoming customer orders and kitchen updates will appear here.'}
            </Text>
          </View>
        ) : (
          /* 3 Grouped Sections: Today, Yesterday, Older */
          sections.map(section => (
            <View key={section.key} style={s.sectionBlock}>
              <View style={s.sectionHeader}>
                <View style={s.sectionHeaderLeft}>
                  <View style={[s.sectionIndicator, section.key === 'today' && s.sectionIndicatorToday]} />
                  <Text style={[s.sectionTitle, rider && s.riderSectionTitle]}>{section.title}</Text>
                </View>
                <View style={[s.sectionBadge, section.key === 'today' && s.sectionBadgeToday]}>
                  <Text style={[s.sectionBadgeText, section.key === 'today' && s.sectionBadgeTextToday]}>
                    {section.items.length}
                  </Text>
                </View>
              </View>

              <View style={s.sectionCards}>
                {section.items.map(item => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    role={role}
                    group={section.key}
                    colors={c}
                    onPress={() => onOpen(item)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const cardStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: vendorRadius.md,
      backgroundColor: c.card,
    },
    riderCard: {
      borderRadius: 18,
    },
    vendorUnread: {
      borderLeftWidth: 3.5,
      borderLeftColor: c.green,
      backgroundColor: c.isDark ? '#16281e' : '#f5fbf7',
    },
    riderUnread: {
      borderLeftWidth: 3.5,
      borderLeftColor: c.green,
      backgroundColor: c.isDark ? '#172b20' : '#f4faf6',
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 3,
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    kicker: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.green,
    },
    time: {
      fontSize: 10,
      fontWeight: '600',
      color: c.muted,
    },
    title: {
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 18,
      color: c.ink,
      marginBottom: 3,
    },
    body: {
      fontSize: 11,
      lineHeight: 16,
      color: c.muted,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: c.line,
    },
    orderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: vendorRadius.pill,
      backgroundColor: c.isDark ? '#1e3328' : c.mint,
    },
    orderBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: c.ink,
    },
    actionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    actionLinkText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.green,
    },
    pressed: {
      opacity: 0.76,
    },
  });

const screenStyles = (c: AppColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.paper,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: c.line,
      backgroundColor: c.paper,
    },
    riderHeader: {
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.line,
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
      color: c.green,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.5,
      color: c.ink,
      marginTop: 2,
    },
    riderTitle: {
      fontSize: 24,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    riderContent: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 40,
    },
    hero: {
      minHeight: 136,
      padding: 18,
      borderRadius: 20,
      backgroundColor: c.isDark ? '#142c20' : '#145c41',
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
    },
    riderHero: {
      borderRadius: 24,
      backgroundColor: c.isDark ? '#12261c' : '#12543b',
    },
    heroOrb1: {
      position: 'absolute',
      top: -30,
      right: -25,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    heroOrb2: {
      position: 'absolute',
      bottom: -35,
      right: 60,
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    heroIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: vendorRadius.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroPulseDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#7dd4a5',
    },
    heroStatusText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#ffffff',
    },
    heroTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: -0.3,
    },
    heroBody: {
      fontSize: 11,
      lineHeight: 16,
      color: '#e0ede5',
      marginTop: 4,
      maxWidth: 290,
    },
    markAllAction: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: vendorRadius.pill,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    markAllActionText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#ffffff',
    },
    sectionBlock: {
      marginBottom: 18,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    sectionIndicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.muted,
    },
    sectionIndicatorToday: {
      backgroundColor: c.green,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5,
      color: c.ink,
    },
    riderSectionTitle: {
      fontSize: 14,
    },
    sectionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: vendorRadius.pill,
      backgroundColor: c.isDark ? '#1a2a22' : c.mint,
    },
    sectionBadgeToday: {
      backgroundColor: c.isDark ? '#234a36' : c.mint,
    },
    sectionBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      color: c.muted,
    },
    sectionBadgeTextToday: {
      color: c.green,
    },
    sectionCards: {
      width: '100%',
    },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 20,
      backgroundColor: c.card,
      marginTop: 10,
    },
    riderStateBox: {
      borderRadius: 24,
    },
    emptyIconBox: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.isDark ? '#1b3327' : c.mint,
      marginBottom: 12,
    },
    errorIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.isDark ? '#381c1c' : '#fdeded',
      marginBottom: 12,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: c.ink,
      marginBottom: 4,
      textAlign: 'center',
    },
    stateBody: {
      fontSize: 12,
      lineHeight: 18,
      color: c.muted,
      textAlign: 'center',
      maxWidth: 260,
    },
    retryButton: {
      marginTop: 14,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: c.green,
    },
    retryButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#ffffff',
    },
    pressed: {
      opacity: 0.75,
    },
  });
