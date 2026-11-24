import { AppText as Text } from '@makanza/mobile-ui';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { NotificationInboxItem } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import { formatOrderNumber } from '../utils/format';

type Props = {
  items: NotificationInboxItem[];
  unreadCount: number;
  loading: boolean;
  error: string;
  hasAccount: boolean;
  colors: AppColors;
  onRetry: () => void;
  onSignIn: () => void;
  onOpen: (item: NotificationInboxItem) => void;
  onReadAll: () => void;
  onBack: () => void;
};

export type NotificationSectionKey = 'today' | 'yesterday' | 'older';

type NotificationTypeStyle = {
  icon: string;
  bgColor: string;
  iconColor: string;
  badgeLabel: string;
};

/**
 * Safely parse a date string into a Date object or null.
 */
export function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Categorize a notification's creation timestamp into 'today', 'yesterday', or 'older'.
 */
export function getSectionKey(dateStr: string, now: Date = new Date()): NotificationSectionKey {
  const d = parseDate(dateStr);
  if (!d) return 'older';

  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const itemMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  if (itemMidnight >= todayMidnight) {
    return 'today';
  }
  if (itemMidnight >= yesterdayMidnight) {
    return 'yesterday';
  }
  return 'older';
}

/**
 * Format timestamp display tailored to the section context.
 */
export function formatNotificationTime(
  dateStr: string,
  section: NotificationSectionKey,
  now: Date = new Date()
): string {
  const d = parseDate(dateStr);
  if (!d) return '';

  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (section === 'today') {
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 6) return `${diffHours}h ago · ${timeStr}`;
    return timeStr;
  }

  if (section === 'yesterday') {
    return timeStr;
  }

  // older
  const dateFormatted = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  return `${dateFormatted} · ${timeStr}`;
}

/**
 * Resolve icon, background tint, accent color, and badge label for a notification type.
 */
function getNotificationTypeStyle(
  type: string,
  p: ReturnType<typeof customerPalette>
): NotificationTypeStyle {
  const upper = (type || '').toUpperCase();

  if (upper.includes('DELIVERED') || upper.includes('SUCCESS')) {
    return {
      icon: 'checkmark-circle-outline',
      bgColor: p.primarySoft,
      iconColor: p.primary,
      badgeLabel: 'Delivered',
    };
  }

  if (
    upper.includes('PICKED_UP') ||
    upper.includes('RIDER_ASSIGNED') ||
    upper.includes('RIDER_OFFER') ||
    upper.includes('ON_THE_WAY') ||
    upper.includes('TRANSIT')
  ) {
    return {
      icon: 'bicycle-outline',
      bgColor: p.primarySoft,
      iconColor: p.primary,
      badgeLabel: 'Delivery',
    };
  }

  if (
    upper.includes('PREPARING') ||
    upper.includes('READY_FOR_PICKUP') ||
    upper.includes('CONFIRMED') ||
    upper.includes('ACCEPTED') ||
    upper.includes('ORDER')
  ) {
    return {
      icon: 'restaurant-outline',
      bgColor: p.accentSoft,
      iconColor: p.accent,
      badgeLabel: 'Order update',
    };
  }

  if (
    upper.includes('CANCELLED') ||
    upper.includes('REJECTED') ||
    upper.includes('FAILED') ||
    upper.includes('EXCEPTION') ||
    upper.includes('ALERT')
  ) {
    return {
      icon: 'alert-circle-outline',
      bgColor: p.accentSoft,
      iconColor: p.danger,
      badgeLabel: 'Attention',
    };
  }

  if (upper.includes('REFUND') || upper.includes('WALLET')) {
    return {
      icon: 'wallet-outline',
      bgColor: p.primarySoft,
      iconColor: p.primary,
      badgeLabel: 'Refund',
    };
  }

  if (upper.includes('PAYMENT')) {
    return {
      icon: 'card-outline',
      bgColor: p.accentSoft,
      iconColor: p.warning,
      badgeLabel: 'Payment',
    };
  }

  return {
    icon: 'notifications-outline',
    bgColor: p.primarySoft,
    iconColor: p.primary,
    badgeLabel: 'Update',
  };
}

export default function NotificationsScreen({
  items,
  unreadCount,
  loading,
  error,
  hasAccount,
  colors: c,
  onRetry,
  onSignIn,
  onOpen,
  onReadAll,
  onBack,
}: Props) {
  const p = customerPalette(c);
  const s = styles(p, c.isDark);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Group notifications into Today, Yesterday, and Older sections
  const sections = useMemo(() => {
    const filtered = filter === 'unread' ? items.filter(item => !item.readAt) : items;

    // Sort newest first
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    const groups: Record<NotificationSectionKey, NotificationInboxItem[]> = {
      today: [],
      yesterday: [],
      older: [],
    };

    for (const item of sorted) {
      const sectionKey = getSectionKey(item.createdAt);
      groups[sectionKey].push(item);
    }

    const sectionConfigs: Array<{
      key: NotificationSectionKey;
      title: string;
      items: NotificationInboxItem[];
      unreadCount: number;
    }> = [];

    if (groups.today.length > 0) {
      sectionConfigs.push({
        key: 'today',
        title: 'Today',
        items: groups.today,
        unreadCount: groups.today.filter(item => !item.readAt).length,
      });
    }

    if (groups.yesterday.length > 0) {
      sectionConfigs.push({
        key: 'yesterday',
        title: 'Yesterday',
        items: groups.yesterday,
        unreadCount: groups.yesterday.filter(item => !item.readAt).length,
      });
    }

    if (groups.older.length > 0) {
      sectionConfigs.push({
        key: 'older',
        title: 'Older',
        items: groups.older,
        unreadCount: groups.older.filter(item => !item.readAt).length,
      });
    }

    return sectionConfigs;
  }, [items, filter]);

  const totalFilteredCount = sections.reduce((sum, sec) => sum + sec.items.length, 0);

  return (
    <View style={s.screen}>
      {/* Header with back button, titles, and mark all action */}
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from Notifications"
          onPress={onBack}
          style={({ pressed }) => [s.backButton, pressed && s.pressed]}
        >
          <Ionicons name="chevron-back" size={21} color={p.primary} />
        </Pressable>

        <View style={s.headerCopy}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
              : 'Updates about your orders & delivery'}
          </Text>
        </View>

        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            onPress={onReadAll}
            style={({ pressed }) => [s.headerAction, pressed && s.pressed]}
          >
            <Ionicons name="checkmark" size={17} color={p.primary} />
          </Pressable>
        ) : (
          <View style={s.headerActionPlaceholder} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.page}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRetry}
            tintColor={p.primary}
            colors={[p.primary]}
          />
        }
      >
        {/* State: Not Signed In */}
        {!hasAccount ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="notifications-outline" size={26} color={p.primary} />
            </View>
            <Text style={s.emptyTitle}>Sign in to see notifications</Text>
            <Text style={s.emptyCopy}>
              Your order updates, delivery tracking alerts, and account activity will appear here once you sign in.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={onSignIn}
              style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
            >
              <Text style={s.primaryBtnText}>Sign in</Text>
            </Pressable>
          </View>
        ) : loading && !items.length ? (
          /* State: Initial Loading */
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={p.primary} />
            <Text style={s.loadingText}>Loading notifications...</Text>
          </View>
        ) : error && !items.length ? (
          /* State: Error */
          <View style={s.empty}>
            <View style={[s.emptyIcon, { backgroundColor: p.accentSoft }]}>
              <Ionicons name="alert-circle-outline" size={26} color={p.danger} />
            </View>
            <Text style={s.emptyTitle}>Notifications couldn’t load</Text>
            <Text style={s.emptyCopy}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try again"
              onPress={onRetry}
              style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
            >
              <Text style={s.primaryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          /* State: No notifications at all */
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="notifications-outline" size={28} color={p.primary} />
            </View>
            <Text style={s.emptyTitle}>You’re all caught up</Text>
            <Text style={s.emptyCopy}>
              We’ll notify you when your order status changes, riders are assigned, or fresh offers drop.
            </Text>
          </View>
        ) : (
          /* State: Notifications List */
          <>
            {/* Filter and Overview Bar */}
            <View style={s.filterRow}>
              <View style={s.filterChips}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === 'all' }}
                  onPress={() => setFilter('all')}
                  style={({ pressed }) => [
                    s.filterChip,
                    filter === 'all' && s.filterChipActive,
                    pressed && s.pressed,
                  ]}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      filter === 'all' && s.filterChipTextActive,
                    ]}
                  >
                    All ({items.length})
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === 'unread' }}
                  onPress={() => setFilter('unread')}
                  style={({ pressed }) => [
                    s.filterChip,
                    filter === 'unread' && s.filterChipActive,
                    pressed && s.pressed,
                  ]}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      filter === 'unread' && s.filterChipTextActive,
                    ]}
                  >
                    Unread ({unreadCount})
                  </Text>
                  {unreadCount > 0 && <View style={s.unreadPillDot} />}
                </Pressable>
              </View>

              {unreadCount > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark all as read"
                  onPress={onReadAll}
                  style={({ pressed }) => [s.markAllInline, pressed && s.pressed]}
                >
                  <Ionicons name="checkmark" size={13} color={p.primary} />
                  <Text style={s.markAllInlineText}>Mark all read</Text>
                </Pressable>
              )}
            </View>

            {/* Empty Unread Filter View */}
            {filter === 'unread' && totalFilteredCount === 0 ? (
              <View style={s.emptyFilter}>
                <View style={s.emptyFilterIcon}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={p.primary} />
                </View>
                <Text style={s.emptyFilterTitle}>No unread notifications</Text>
                <Text style={s.emptyFilterCopy}>
                  You’re all caught up with your updates. Switch back to view your full history.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFilter('all')}
                  style={({ pressed }) => [s.filterSwitchBtn, pressed && s.pressed]}
                >
                  <Text style={s.filterSwitchText}>View all notifications</Text>
                </Pressable>
              </View>
            ) : (
              /* Grouped Sections: Today, Yesterday, Older */
              sections.map(section => (
                <View key={section.key} style={s.section}>
                  {/* Section Header */}
                  <View style={s.sectionHeader}>
                    <View style={s.sectionHeaderLeft}>
                      <Text style={s.sectionTitle}>{section.title}</Text>
                      <View style={s.sectionBadge}>
                        <Text style={s.sectionBadgeText}>{section.items.length}</Text>
                      </View>
                    </View>

                    {section.unreadCount > 0 && (
                      <View style={s.sectionUnreadBadge}>
                        <View style={s.sectionUnreadDot} />
                        <Text style={s.sectionUnreadText}>
                          {section.unreadCount} new
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Section Cards */}
                  <View style={s.sectionCards}>
                    {section.items.map(item => {
                      const isRead = !!item.readAt;
                      const typeConfig = getNotificationTypeStyle(item.type, p);
                      const timeFormatted = formatNotificationTime(item.createdAt, section.key);

                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityHint={
                            item.orderId
                              ? `Opens order ${formatOrderNumber(item.displayNumber, item.orderId)}`
                              : 'Opens this notification'
                          }
                          onPress={() => onOpen(item)}
                          style={({ pressed }) => [
                            s.card,
                            !isRead && s.cardUnread,
                            pressed && s.pressed,
                          ]}
                        >
                          {/* Unread Accent Indicator on Card Edge */}
                          {!isRead && <View style={s.unreadBar} />}

                          {/* Category / Type Icon */}
                          <View style={[s.iconBox, { backgroundColor: typeConfig.bgColor }]}>
                            <Ionicons name={typeConfig.icon} size={20} color={typeConfig.iconColor} />
                          </View>

                          {/* Notification Details */}
                          <View style={s.cardBodyContainer}>
                            <View style={s.cardMetaRow}>
                              {item.orderId ? (
                                <View style={s.orderPill}>
                                  <Text style={s.orderPillText} numberOfLines={1}>
                                    Order {formatOrderNumber(item.displayNumber, item.orderId)}
                                  </Text>
                                </View>
                              ) : (
                                <View style={s.typePill}>
                                  <Text style={s.typePillText}>{typeConfig.badgeLabel}</Text>
                                </View>
                              )}

                              <View style={s.timeRow}>
                                <Text style={s.timestamp}>{timeFormatted}</Text>
                                {!isRead && <View style={s.unreadDot} />}
                              </View>
                            </View>

                            <Text
                              style={[s.cardTitle, !isRead && s.cardTitleUnread]}
                              numberOfLines={2}
                            >
                              {item.title}
                            </Text>

                            <Text style={s.cardMessage} numberOfLines={3}>
                              {item.body}
                            </Text>

                            {item.orderId && (
                              <View style={s.cardFooter}>
                                <Text style={s.viewOrderLink}>Track order</Text>
                                <Ionicons name="chevron-forward" size={13} color={p.primary} />
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (p: ReturnType<typeof customerPalette>, isDark: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: p.canvas,
    },
    header: {
      minHeight: 70,
      paddingHorizontal: customerSpace.lg,
      paddingVertical: customerSpace.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: customerSpace.md,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
      backgroundColor: p.canvas,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.surfaceAlt,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '900',
      color: p.ink,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 11,
      lineHeight: 16,
      color: p.muted,
      marginTop: 2,
    },
    headerAction: {
      width: 42,
      height: 42,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.primarySoft,
    },
    headerActionPlaceholder: {
      width: 42,
    },
    page: {
      paddingHorizontal: customerSpace.lg,
      paddingTop: customerSpace.md,
      paddingBottom: customerSpace.xxl + 20,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: customerSpace.lg,
      gap: 8,
    },
    filterChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: customerRadius.pill,
      backgroundColor: p.surfaceAlt,
      borderWidth: 1,
      borderColor: p.border,
      gap: 6,
    },
    filterChipActive: {
      backgroundColor: p.primarySoft,
      borderColor: p.primary,
    },
    filterChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: p.muted,
    },
    filterChipTextActive: {
      color: p.primary,
      fontWeight: '900',
    },
    unreadPillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: p.accent,
    },
    markAllInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    markAllInlineText: {
      fontSize: 11,
      fontWeight: '800',
      color: p.primary,
    },
    section: {
      marginBottom: customerSpace.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: customerSpace.sm + 2,
      paddingHorizontal: 2,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: p.ink,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    sectionBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: customerRadius.pill,
      backgroundColor: p.surfaceAlt,
      borderWidth: 1,
      borderColor: p.border,
    },
    sectionBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: p.muted,
    },
    sectionUnreadBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: customerRadius.pill,
      backgroundColor: p.accentSoft,
    },
    sectionUnreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: p.accent,
    },
    sectionUnreadText: {
      fontSize: 10,
      fontWeight: '800',
      color: p.accent,
    },
    sectionCards: {
      gap: 9,
    },
    card: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 13,
      borderRadius: customerRadius.md,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      overflow: 'hidden',
    },
    cardUnread: {
      borderColor: isDark ? '#2e4e3a' : '#d2ebd9',
      backgroundColor: isDark ? '#16271e' : '#f9fcf9',
    },
    unreadBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: p.primary,
      borderTopLeftRadius: customerRadius.md,
      borderBottomLeftRadius: customerRadius.md,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: customerRadius.sm + 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    cardBodyContainer: {
      flex: 1,
      minWidth: 0,
    },
    cardMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 5,
    },
    orderPill: {
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: customerRadius.sm,
      backgroundColor: p.primarySoft,
    },
    orderPillText: {
      fontSize: 9,
      fontWeight: '800',
      color: p.primary,
    },
    typePill: {
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: customerRadius.sm,
      backgroundColor: p.surfaceAlt,
    },
    typePillText: {
      fontSize: 9,
      fontWeight: '800',
      color: p.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    timestamp: {
      fontSize: 10,
      color: p.muted,
      fontWeight: '600',
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: p.accent,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
      color: p.ink,
      letterSpacing: -0.2,
    },
    cardTitleUnread: {
      fontWeight: '900',
    },
    cardMessage: {
      fontSize: 11,
      lineHeight: 16,
      color: p.muted,
      marginTop: 4,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: p.border,
    },
    viewOrderLink: {
      fontSize: 10,
      fontWeight: '800',
      color: p.primary,
    },
    emptyFilter: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyFilterIcon: {
      width: 52,
      height: 52,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.primarySoft,
      marginBottom: 12,
    },
    emptyFilterTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: p.ink,
      textAlign: 'center',
    },
    emptyFilterCopy: {
      fontSize: 11,
      lineHeight: 16,
      color: p.muted,
      textAlign: 'center',
      marginTop: 5,
      maxWidth: 260,
    },
    filterSwitchBtn: {
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: customerRadius.sm,
      backgroundColor: p.surfaceAlt,
      borderWidth: 1,
      borderColor: p.border,
    },
    filterSwitchText: {
      fontSize: 11,
      fontWeight: '800',
      color: p.primary,
    },
    empty: {
      flex: 1,
      minHeight: 320,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: customerRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.primarySoft,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: p.ink,
      textAlign: 'center',
      marginTop: 14,
      letterSpacing: -0.3,
    },
    emptyCopy: {
      fontSize: 11,
      lineHeight: 17,
      color: p.muted,
      textAlign: 'center',
      marginTop: 6,
      maxWidth: 280,
    },
    primaryBtn: {
      minHeight: 42,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: customerRadius.sm,
      backgroundColor: p.primary,
      marginTop: 16,
    },
    primaryBtnText: {
      fontSize: 12,
      fontWeight: '900',
      color: 'white',
    },
    loadingContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 12,
      fontWeight: '700',
      color: p.muted,
    },
    pressed: {
      opacity: 0.76,
    },
  });
