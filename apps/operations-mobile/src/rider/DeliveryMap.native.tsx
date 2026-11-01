import { AppText as Text } from '@makanza/mobile-ui';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import type { RiderDelivery } from '@makanza/mobile-core';
import { api } from '../services/api';
import { mobileEnv } from '../config/env';
import type { AppColors } from '../theme/colors';

type Coordinate = { latitude: number; longitude: number };
type RouteData = { deliveryId: string; leg: 'PICKUP' | 'DROPOFF'; origin: Coordinate; destination: Coordinate; distanceMeters: number; durationSeconds: number | null; encodedPolyline: string; provider: 'google-routes' };
const coord = (latitude: number | string | null | undefined, longitude: number | string | null | undefined): Coordinate | null => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? point : null;
};

export default function DeliveryMap({ delivery, token, colors: c }: { delivery: RiderDelivery; token: string; colors: AppColors }) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const vendorPoint = coord(delivery.order.vendor.latitude, delivery.order.vendor.longitude);
  const customerPoint = coord(delivery.order.address?.latitude, delivery.order.address?.longitude);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRoute(null);
    if (!mobileEnv.googleMapsEnabled) { setLoading(false); return () => { active = false; }; }
    api.get<RouteData>(`/rider/deliveries/${encodeURIComponent(delivery.id)}/route`, token)
      .then(result => { if (active) setRoute(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Route details are unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [delivery.id, delivery.status, token]);

  const coordinates = useMemo(() => route?.encodedPolyline ? decodePolyline(route.encodedPolyline) : [], [route?.encodedPolyline]);
  const region = useMemo((): Region | undefined => {
    const points = [route?.origin, route?.destination, vendorPoint, customerPoint].filter((p): p is Coordinate => !!p);
    if (!points.length) return undefined;
    const minLat = Math.min(...points.map(p => p.latitude)); const maxLat = Math.max(...points.map(p => p.latitude));
    const minLng = Math.min(...points.map(p => p.longitude)); const maxLng = Math.max(...points.map(p => p.longitude));
    return { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2, latitudeDelta: Math.max(.012, (maxLat - minLat) * 1.8), longitudeDelta: Math.max(.012, (maxLng - minLng) * 1.8) };
  }, [route, vendorPoint?.latitude, vendorPoint?.longitude, customerPoint?.latitude, customerPoint?.longitude]);

  const destination = route?.destination ?? (delivery.status === 'PICKED_UP' ? customerPoint : vendorPoint);
  const mapPoints = route ? [route.origin, route.destination] : destination ? [destination] : [];

  return <View style={[styles.wrap, { backgroundColor: c.cream, borderColor: c.line }]}>
    {mobileEnv.googleMapsEnabled && region ? <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={region} region={region} showsUserLocation showsMyLocationButton>
      {mapPoints.map((point, index) => <Marker key={`${index}-${point.latitude}-${point.longitude}`} coordinate={point} title={route ? index === 0 ? 'Your current location' : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name} pinColor={route && index === 0 ? '#194c3a' : '#e87c59'}/>)}
      {coordinates.length > 1 && <Polyline coordinates={coordinates} strokeWidth={5} strokeColor="#194c3a"/>}
    </MapView> : <View style={styles.mapFallback}><Text style={[styles.fallbackTitle, { color: c.ink }]}>Route map</Text><Text style={[styles.fallbackCopy, { color: c.muted }]}>{mobileEnv.googleMapsEnabled ? 'A map pin is not available for this stop.' : 'Add restricted Google Maps SDK keys to the EAS build to show the live map.'}</Text></View>}
    <View style={styles.routeMeta}>
      <View style={styles.routeCopy}><Text style={[styles.leg, { color: c.green }]}>{route?.leg === 'DROPOFF' || delivery.status === 'PICKED_UP' ? 'TO CUSTOMER' : 'TO PICKUP'}</Text><Text style={[styles.distance, { color: c.ink }]}>{route ? `${(route.distanceMeters / 1000).toFixed(1)} km · ${route.durationSeconds === null ? 'ETA unavailable' : `${Math.max(1, Math.round(route.durationSeconds / 60))} min`}` : loading ? 'Calculating Google route…' : error}</Text></View>
      {destination && <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`)} style={[styles.navigate, { backgroundColor: c.green }]}><Text style={styles.navigateText}>Navigate</Text></Pressable>}
    </View>
    {loading && <ActivityIndicator style={styles.loader} color={c.green}/>}
  </View>;
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []; let index = 0; let latitude = 0; let longitude = 0;
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

const styles = StyleSheet.create({ wrap: { overflow: 'hidden', borderWidth: 1, borderRadius: 15, marginTop: 5 }, map: { height: 220, width: '100%' }, mapFallback: { minHeight: 112, padding: 15, justifyContent: 'center' }, fallbackTitle: { fontSize: 15, fontWeight: '900' }, fallbackCopy: { fontSize: 12, lineHeight: 18, marginTop: 4 }, routeMeta: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, routeCopy: { flex: 1 }, leg: { fontSize: 10, fontWeight: '900', letterSpacing: .8 }, distance: { fontSize: 12, fontWeight: '700', marginTop: 3 }, navigate: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 }, navigateText: { color: 'white', fontSize: 11, fontWeight: '900' }, loader: { position: 'absolute', top: 12, right: 12 } });
