import { AppText as Text } from '@makanza/mobile-ui';
import { Bike, LocateFixed, MapPin, Store } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import type { OrderTracking } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';

type Props = { tracking: OrderTracking | null; loading: boolean; error: string; colors: AppColors };
type Coordinate = { latitude: number; longitude: number };

function point(latitude: number | null | undefined, longitude: number | null | undefined): Coordinate | null {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function MarkerBadge({ icon, color, background }: { icon: 'store' | 'bike' | 'pin'; color: string; background: string }) {
  const Icon = icon === 'store' ? Store : icon === 'bike' ? Bike : MapPin;
  return <View style={[styles.marker, { backgroundColor: background, borderColor: color }]}><Icon size={icon === 'bike' ? 19 : 17} color={color} strokeWidth={2.7} /></View>;
}

export default function OrderTrackingMap({ tracking, loading, error, colors: c }: Props) {
  const map = useRef<MapView>(null);
  const vendor = point(tracking?.vendor.latitude, tracking?.vendor.longitude);
  const customer = point(tracking?.customer.latitude, tracking?.customer.longitude);
  const rider = point(tracking?.rider?.latitude, tracking?.rider?.longitude);
  const isPickedUp = tracking?.deliveryStatus === 'PICKED_UP';
  const endpoints = useMemo(() => [vendor, customer].filter((item): item is Coordinate => item !== null), [vendor?.latitude, vendor?.longitude, customer?.latitude, customer?.longitude]);
  const region = useMemo((): Region | undefined => {
    const points = [vendor, customer, rider].filter((item): item is Coordinate => item !== null);
    if (!points.length) return undefined;
    const lats = points.map(item => item.latitude); const lngs = points.map(item => item.longitude);
    return { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2, latitudeDelta: Math.max(.012, (Math.max(...lats) - Math.min(...lats)) * 1.8), longitudeDelta: Math.max(.012, (Math.max(...lngs) - Math.min(...lngs)) * 1.8) };
  }, [vendor?.latitude, vendor?.longitude, customer?.latitude, customer?.longitude, rider?.latitude, rider?.longitude]);
  const locationAge = tracking?.rider?.updatedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(tracking.rider.updatedAt)) / 1000)) : null;
  const recent = locationAge !== null && locationAge < 120;

  useEffect(() => {
    if (endpoints.length > 1) map.current?.fitToCoordinates(endpoints, { edgePadding: { top: 80, right: 54, bottom: 116, left: 54 }, animated: false });
    else if (region) map.current?.animateToRegion(region, 0);
  }, [endpoints.length, vendor?.latitude, vendor?.longitude, customer?.latitude, customer?.longitude]);

  const recenter = () => {
    const points = [rider, customer, vendor].filter((item): item is Coordinate => item !== null);
    if (points.length > 1) map.current?.fitToCoordinates(points, { edgePadding: { top: 78, right: 48, bottom: 115, left: 48 }, animated: true });
    else if (region) map.current?.animateToRegion(region, 350);
  };

  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
    <View style={styles.mapFrame}>
      {region ? <MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={region} showsCompass={false} showsBuildings showsTraffic={false} toolbarEnabled={false}>
        {vendor && <Marker coordinate={vendor} title={tracking?.vendor.name ?? 'Restaurant'} description="Restaurant pickup"><MarkerBadge icon="store" color={c.green} background={c.card} /></Marker>}
        {customer && <Marker coordinate={customer} title="Delivery address" description="Your delivery destination"><MarkerBadge icon="pin" color="#d36545" background={c.card} /></Marker>}
        {rider && <Marker coordinate={rider} title="Your rider" description={recent ? 'Live location' : 'Last known location'} zIndex={3}><View style={[styles.riderHalo, { backgroundColor: c.isDark ? 'rgba(124,199,160,.2)' : 'rgba(29,97,71,.15)' }]}><MarkerBadge icon="bike" color="#fff" background={c.green} /></View></Marker>}
      </MapView> : <View style={[styles.noMap, { backgroundColor: c.cream }]}>
        <View style={[styles.noMapIcon, { backgroundColor: c.mint }]}><MapPin size={24} color={c.green} /></View>
        <Text style={[styles.noMapTitle, { color: c.ink }]}>Your delivery map</Text>
        <Text style={[styles.noMapCopy, { color: c.muted }]}>{!region ? 'Map pins are not available for this order yet.' : 'Google Maps SDK keys are missing from this build.'}</Text>
      </View>}
      {region && <>
        <View style={[styles.mapTopPill, { backgroundColor: c.card }]}><View style={[styles.liveDot, { backgroundColor: rider && recent ? '#20a36b' : c.muted }]} /><Text style={[styles.mapTopText, { color: c.ink }]}>{rider && recent ? 'LIVE TRACKING' : rider ? 'LAST KNOWN LOCATION' : 'RIDER ON THE WAY'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Recenter delivery map" onPress={recenter} style={[styles.recenter, { backgroundColor: c.card }]}><LocateFixed size={19} color={c.ink} /></Pressable>
        <View style={[styles.mapCaption, { backgroundColor: c.card }]}><Text style={[styles.captionText, { color: c.ink }]}>{isPickedUp ? 'Heading to you' : 'Going to restaurant'}</Text><Text style={[styles.captionSub, { color: c.muted }]}>{isPickedUp ? 'Your rider has picked up the order' : 'Your rider is heading to the pickup'}</Text></View>
      </>}
    </View>
    <View style={styles.details}>
      <View style={[styles.riderAvatar, { backgroundColor: c.mint }]}><Bike size={21} color={c.green} /></View>
      <View style={styles.detailCopy}>
        <Text style={[styles.detailTitle, { color: c.ink }]}>{tracking?.rider ? isPickedUp ? 'Your order is on the way' : 'Your rider is heading to pickup' : 'Finding your rider'}</Text>
        <Text style={[styles.detailSub, { color: c.muted }]}>{tracking?.rider ? `${tracking.vendor.name} · ${locationAge === 0 ? 'Updated just now' : `Updated ${locationAge}s ago`}` : loading ? 'Waiting for rider location…' : error || 'Live location will appear when available.'}</Text>
      </View>
      {tracking?.rider && <View style={[styles.statusChip, { backgroundColor: recent ? c.mint : c.cream }]}><View style={[styles.statusDot, { backgroundColor: recent ? c.green : c.muted }]} /><Text style={[styles.statusText, { color: recent ? c.green : c.muted }]}>{recent ? 'LIVE' : 'UPDATING'}</Text></View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  mapFrame: { height: 300, overflow: 'hidden' },
  noMap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  noMapIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  noMapTitle: { fontSize: 16, fontWeight: '900' }, noMapCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  mapTopPill: { position: 'absolute', top: 12, left: 12, height: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, elevation: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4 }, mapTopText: { fontSize: 10, fontWeight: '900', letterSpacing: .65 },
  recenter: { position: 'absolute', top: 12, right: 12, width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  mapCaption: { position: 'absolute', bottom: 12, left: 12, right: 12, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 13, elevation: 3 },
  captionText: { fontSize: 13, fontWeight: '900' }, captionSub: { fontSize: 11, marginTop: 2 },
  marker: { width: 37, height: 37, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  riderHalo: { width: 51, height: 51, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  details: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 11 },
  riderAvatar: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, detailCopy: { flex: 1 },
  detailTitle: { fontSize: 13, fontWeight: '900' }, detailSub: { fontSize: 11, marginTop: 4 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 8, paddingVertical: 6 }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontSize: 9, fontWeight: '900', letterSpacing: .5 },
});
