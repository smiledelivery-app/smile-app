import { AppText as Text } from '@makanza/mobile-ui';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import type { CartLine } from '../types/cart';
import { darkColors, lightColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';

type Props = {
  visible?: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  address: string;
  locationLabel: string;
  hasPinnedLocation: boolean;
  busy: boolean;
  error: string;
  hasAccount: boolean;
  dark: boolean;
  demoMode: boolean;
  pendingPayment: boolean;
  onQuantity: (lineId: string, delta: number) => void;
  onPlaceOrder: () => void;
  onContinuePayment: () => void;
  onBrowse: () => void;
  onSignIn: () => void;
  onPickAddress: () => void;
};
const money = (minor: number) => `₦${(minor / 100).toLocaleString('en-NG')}`;

export default function CartScreen(p: Props) {
  const colors = p.dark ? darkColors : lightColors;
  const c = customerPalette(colors);
  const s = styles(c);
  const count = p.lines.reduce((sum, line) => sum + line.quantity, 0);

  if (p.visible === false) return null;

  return (
    <Modal visible={p.visible !== false} transparent animationType="slide" onRequestClose={p.onClose}>
      <View style={s.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss cart" style={s.backdrop} onPress={p.onClose} />
        <View style={s.sheet}>
          <View style={s.dragHandle} />
          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              <View style={s.modalHeaderIcon}>
                <Ionicons name="cart-outline" size={20} color={c.primary} />
              </View>
              <View style={s.modalHeaderCopy}>
                <Text style={s.modalTitle}>Your bag</Text>
                <Text style={s.modalSubtitle}>{count ? `${count} ${count === 1 ? 'item' : 'items'} ready for checkout` : 'Review your order before checkout'}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close cart" onPress={p.onClose} style={({ pressed }) => [s.closeButton, pressed && s.pressed]}>
              <Ionicons name="close" size={20} color={c.ink} />
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            {p.lines.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}><Ionicons name="basket-outline" size={30} color={c.primary} /></View>
                <Text style={s.emptyTitle}>Your bag is empty</Text>
                <Text style={s.muted}>Find something lovely from a kitchen nearby.</Text>
                <Pressable accessibilityRole="button" onPress={p.onClose} style={s.browse}>
                  <Text style={s.browseText}>Explore kitchens</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </Pressable>
              </View>
            ) : (
              <>
                <View style={s.vendorHeading}>
                  <View style={s.vendorIcon}><Ionicons name="storefront-outline" size={20} color={c.primary} /></View>
                  <View style={s.vendorCopy}>
                    <Text style={s.kicker}>ORDERING FROM</Text>
                    <Text style={s.vendor}>{p.lines[0].vendorName}</Text>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={21} color={c.primary} />
                </View>

                <View style={s.itemsCard}>
                  {p.lines.map((line, index) => {
                    const unit = line.product.priceMinor + line.addons.reduce((sum, x) => sum + x.addon.priceMinor * x.quantity, 0);
                    return (
                      <View key={line.id} style={[s.line, index < p.lines.length - 1 && s.lineDivider]}>
                        <View style={s.itemIcon}><Ionicons name="restaurant-outline" size={19} color={c.primary} /></View>
                        <View style={s.copy}>
                          <Text style={s.itemName}>{line.product.name}</Text>
                          {line.addons.map(x => (
                            <Text key={x.addon.id} style={s.addon}>+ {x.quantity} × {x.addon.name}</Text>
                          ))}
                          <Text style={s.unitPrice}>{money(unit)} each</Text>
                          <Text style={s.lineTotal}>{money(unit * line.quantity)}</Text>
                        </View>
                        <View style={s.quantity}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remove one ${line.product.name}`}
                            disabled={p.pendingPayment}
                            onPress={() => p.onQuantity(line.id, -1)}
                            style={[s.qtyButton, p.pendingPayment && s.disabled]}
                          >
                            <Text style={s.qtyText}>−</Text>
                          </Pressable>
                          <Text style={s.qty}>{line.quantity}</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add one ${line.product.name}`}
                            disabled={p.pendingPayment}
                            onPress={() => p.onQuantity(line.id, 1)}
                            style={[s.qtyButton, p.pendingPayment && s.disabled]}
                          >
                            <Text style={s.qtyText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Pressable accessibilityRole="button" accessibilityLabel="Add more items to bag" onPress={p.onClose} style={({ pressed }) => [s.addMore, pressed && s.pressed]}>
                  <Ionicons name="add-circle-outline" size={18} color={c.primary} />
                  <Text style={s.addMoreText}>Add more items</Text>
                </Pressable>

                <View style={s.summary}>
                  <View style={s.summaryLine}>
                    <Text style={s.summaryLabel}>Food subtotal</Text>
                    <Text style={s.summaryValue}>{money(p.subtotal)}</Text>
                  </View>
                  <View style={s.feeNote}>
                    <Ionicons name="information-circle-outline" size={17} color={c.muted} />
                    <Text style={s.feeText}>Delivery fee and final total are confirmed at checkout.</Text>
                  </View>
                </View>

                <View style={s.sectionHeading}>
                  <View style={s.sectionIcon}><Ionicons name="location-outline" size={19} color={c.primary} /></View>
                  <View>
                    <Text style={s.sectionTitle}>Delivery details</Text>
                    <Text style={s.sectionSub}>Where should we bring your order?</Text>
                  </View>
                </View>

                <Pressable accessibilityRole="button" onPress={p.onPickAddress} style={({ pressed }) => [s.saved, p.hasPinnedLocation && s.savedSelected, pressed && s.pressed]}>
                  <View style={s.savedIcon}><Ionicons name={p.hasPinnedLocation ? 'location' : 'map-outline'} size={20} color={c.primary} /></View>
                  <View style={s.savedCopy}>
                    <Text style={s.savedTitle}>{p.hasPinnedLocation ? p.locationLabel : 'Choose a delivery location'}</Text>
                    <Text style={s.savedText}>{p.hasPinnedLocation ? p.address : 'Search for a place or pin it on the map'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={19} color={c.muted} />
                </Pressable>

                {p.error ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color="#a34232" />
                    <Text style={s.error}>{p.error}</Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={p.busy}
                  onPress={p.pendingPayment ? p.onContinuePayment : p.hasPinnedLocation ? (p.hasAccount ? p.onPlaceOrder : p.onSignIn) : p.onPickAddress}
                  style={({ pressed }) => [s.checkout, p.busy && s.disabled, pressed && !p.busy && s.pressed]}
                >
                  <Text style={s.checkoutText}>
                    {p.busy ? 'Processing…' : p.pendingPayment ? 'Continue to payment' : !p.hasPinnedLocation ? 'Choose delivery location' : p.hasAccount ? 'Review and place order' : 'Sign in to continue'}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color="white" />
                </Pressable>
                <Text style={s.note}>{p.demoMode ? 'Development checkout is isolated and does not charge money.' : 'Pay securely with your Smile wallet or Paystack.'}</Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: ReturnType<typeof customerPalette>) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 11, 0.58)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    height: '88%',
    maxHeight: '92%',
    borderTopLeftRadius: customerRadius.xl,
    borderTopRightRadius: customerRadius.xl,
    backgroundColor: c.canvas,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: customerSpace.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.canvas,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: c.ink,
  },
  modalSubtitle: {
    fontSize: 11,
    color: c.muted,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  page: {
    paddingHorizontal: customerSpace.lg,
    paddingTop: customerSpace.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  empty: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: customerRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: c.ink,
    marginTop: 14,
  },
  muted: {
    fontSize: 12,
    lineHeight: 19,
    color: c.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  browse: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 17,
    borderRadius: customerRadius.md,
    backgroundColor: c.primary,
    marginTop: 17,
  },
  browseText: {
    fontSize: 12,
    fontWeight: '900',
    color: 'white',
  },
  vendorHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: customerRadius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 10,
  },
  vendorIcon: {
    width: 40,
    height: 40,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  vendorCopy: {
    flex: 1,
  },
  kicker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: c.muted,
  },
  vendor: {
    fontSize: 14,
    fontWeight: '900',
    color: c.ink,
    marginTop: 3,
  },
  itemsCard: {
    paddingHorizontal: 12,
    borderRadius: customerRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  line: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  lineDivider: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  copy: {
    flex: 1,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '900',
    color: c.ink,
  },
  addon: {
    fontSize: 10,
    lineHeight: 15,
    color: c.muted,
    marginTop: 3,
  },
  unitPrice: {
    fontSize: 10,
    color: c.muted,
    marginTop: 4,
  },
  lineTotal: {
    fontSize: 11,
    fontWeight: '900',
    color: c.primary,
    marginTop: 2,
  },
  quantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: customerRadius.sm,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 20,
    lineHeight: 23,
    color: c.primary,
    fontWeight: '800',
  },
  qty: {
    minWidth: 14,
    fontSize: 13,
    fontWeight: '900',
    color: c.ink,
    textAlign: 'center',
  },
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    marginTop: 9,
    borderRadius: customerRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: c.primary,
  },
  summary: {
    padding: 14,
    borderRadius: customerRadius.md,
    backgroundColor: c.surfaceAlt,
    marginTop: 11,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: c.ink,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '900',
    color: c.primary,
  },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
  },
  feeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: c.muted,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionIcon: {
    width: 37,
    height: 37,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primarySoft,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: c.ink,
  },
  sectionSub: {
    fontSize: 10,
    color: c.muted,
    marginTop: 3,
  },
  saved: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: customerRadius.md,
    backgroundColor: c.surface,
  },
  savedSelected: {
    borderColor: c.primary,
  },
  savedIcon: {
    width: 38,
    height: 38,
    borderRadius: customerRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  savedCopy: {
    flex: 1,
    gap: 3,
  },
  savedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: c.ink,
  },
  savedText: {
    fontSize: 10,
    lineHeight: 15,
    color: c.muted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: customerRadius.sm,
    backgroundColor: c.accentSoft,
    marginTop: 11,
  },
  error: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: c.danger,
  },
  checkout: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    borderRadius: customerRadius.md,
    backgroundColor: c.primary,
    marginTop: 16,
  },
  checkoutText: {
    fontSize: 13,
    fontWeight: '900',
    color: 'white',
  },
  note: {
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    color: c.muted,
    marginTop: 9,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
