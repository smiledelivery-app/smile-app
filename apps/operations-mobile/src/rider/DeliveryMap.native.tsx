import { AppText as Text } from '@makanza/mobile-ui';
import { WebView, type DomWebViewRef } from '@expo/dom-webview';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';
import type { RiderDelivery } from '@makanza/mobile-core';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { hasNativeGoogleMapsSdk } from '../utils/google-maps';
import { getLeafletMapUri } from '../utils/leaflet-html';

type Coordinate = { latitude: number; longitude: number };
type RouteData = { deliveryId: string; leg: 'PICKUP' | 'DROPOFF'; origin: Coordinate; destination: Coordinate; distanceMeters: number; durationSeconds: number | null; encodedPolyline: string; provider: 'google' };
const coord = (latitude: number | string | null | undefined, longitude: number | string | null | undefined): Coordinate | null => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? point : null;
};

const leafletDeliveryHtml = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      onerror="this.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'">
    <style>html,body,#map{height:100%;width:100%;margin:0;background:#e8ede8}.leaflet-container{font-family:Arial,sans-serif}</style>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      if (!window.L) {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}));
      } else {
        const map = L.map('map', { zoomControl: false }).setView([9.082, 8.6753], 6);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        });
        let fallbackLoaded = false;
        tiles.on('tileerror', () => {
          if (fallbackLoaded) return;
          fallbackLoaded = true;
          map.removeLayer(tiles);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }).addTo(map);
        });
        tiles.addTo(map);
        let markers = [];
        let line = null;
        window.updateDeliveryRoute = data => {
          markers.forEach(m => map.removeLayer(m));
          markers = [];
          if (line) { map.removeLayer(line); line = null; }
          const boundsPoints = [];
          (data.points || []).forEach(item => {
            const pos = [item.latitude, item.longitude];
            boundsPoints.push(pos);
            const marker = L.circleMarker(pos, {
              radius: 8,
              color: '#ffffff',
              weight: 2.5,
              fillColor: item.color || '#e87c59',
              fillOpacity: 1
            }).addTo(map);
            if (item.title) marker.bindPopup(item.title);
            markers.push(marker);
          });
          if (data.coordinates && data.coordinates.length > 1) {
            const latlngs = data.coordinates.map(c => [c.latitude, c.longitude]);
            line = L.polyline(latlngs, { color: '#194c3a', weight: 5 }).addTo(map);
            latlngs.forEach(pt => boundsPoints.push(pt));
          }
          if (boundsPoints.length > 1) {
            map.fitBounds(L.latLngBounds(boundsPoints), { padding: [36, 36], maxZoom: 16 });
          } else if (boundsPoints.length === 1) {
            map.setView(boundsPoints[0], 15);
          }
        };
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
      }
    </script>
  </body>
</html>`;

function GoogleDeliveryMapView({ region, mapPoints, coordinates, route, delivery, onFallback }: { region: Region; mapPoints: Coordinate[]; coordinates: LatLng[]; route: RouteData | null; delivery: RiderDelivery; onFallback: () => void }) {
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapReady) return;
    const timer = setTimeout(onFallback, 8000);
    return () => clearTimeout(timer);
  }, [mapReady, onFallback]);

  return (
    <MapView provider={PROVIDER_GOOGLE} style={styles.map} initialRegion={region} region={region} onMapReady={() => setMapReady(true)} showsUserLocation showsMyLocationButton>
      {mapPoints.map((point, index) => (
        <Marker
          key={`${index}-${point.latitude}-${point.longitude}`}
          coordinate={point}
          title={route ? index === 0 ? 'Your current location' : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name}
          pinColor={route && index === 0 ? '#194c3a' : '#e87c59'}
        />
      ))}
      {coordinates.length > 1 && <Polyline coordinates={coordinates} strokeWidth={5} strokeColor="#194c3a" />}
    </MapView>
  );
}

function LeafletDeliveryMapView({ mapPoints, coordinates, route, delivery, colors: c }: { mapPoints: Coordinate[]; coordinates: LatLng[]; route: RouteData | null; delivery: RiderDelivery; colors: AppColors }) {
  const webMap = useRef<DomWebViewRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const source = useMemo(() => ({ uri: getLeafletMapUri('rider-delivery-map.html', leafletDeliveryHtml) }), []);

  const payload = useMemo(() => ({
    points: mapPoints.map((point, index) => ({
      ...point,
      title: route ? index === 0 ? 'Your current location' : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name : delivery.status === 'PICKED_UP' ? 'Customer drop-off' : delivery.order.vendor.name,
      color: route && index === 0 ? '#194c3a' : '#e87c59',
    })),
    coordinates,
  }), [mapPoints, coordinates, route, delivery.status, delivery.order.vendor.name]);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!mapReady) return;
    webMap.current?.injectJavaScript(`window.updateDeliveryRoute(${JSON.stringify(payload)});true;`);
  }, [mapReady, payload]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    let message: { type?: string };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      setMapError(true);
      return;
    }
    if (message.type === 'ready') {
      setMapReady(true);
      setMapError(false);
      webMap.current?.injectJavaScript(`window.updateDeliveryRoute(${JSON.stringify(payloadRef.current)});true;`);
    } else if (message.type === 'error') {
      setMapError(true);
    }
  };

  return (
    <View style={styles.map}>
      <WebView
        ref={webMap}
        style={styles.map}
        containerStyle={styles.map}
        source={source}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        onRenderProcessGone={() => setMapError(true)}
        onContentProcessDidTerminate={() => setMapError(true)}
      />
      {mapError && (
        <View pointerEvents="none" style={[styles.webOverlay, { backgroundColor: c.cream }]}>
          <Text style={[styles.fallbackCopy, { color: c.muted }]}>Route map could not load. Check your internet connection.</Text>
        </View>
      )}
    </View>
  );
}

export default function DeliveryMap({ delivery, token, colors: c }: { delivery: RiderDelivery; token: string; colors: AppColors }) {
  const [route, setRoute] = useState<RouteData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(() => !hasNativeGoogleMapsSdk());
  const triggerFallback = useCallback(() => setUseFallback(true), []);
  const vendorPoint = coord(delivery.order.vendor.latitude, delivery.order.vendor.longitude);
  const customerPoint = coord(delivery.order.address?.latitude, delivery.order.address?.longitude);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRoute(null);
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
  const mapPoints = useMemo(() => route ? [route.origin, route.destination] : destination ? [destination] : [], [route, destination]);

  return <View style={[styles.wrap, { backgroundColor: c.cream, borderColor: c.line }]}>
    {region ? (
      useFallback ? (
        <LeafletDeliveryMapView mapPoints={mapPoints} coordinates={coordinates} route={route} delivery={delivery} colors={c} />
      ) : (
        <GoogleDeliveryMapView region={region} mapPoints={mapPoints} coordinates={coordinates} route={route} delivery={delivery} onFallback={triggerFallback} />
      )
    ) : <View style={styles.mapFallback}><Text style={[styles.fallbackTitle, { color: c.ink }]}>Route map</Text><Text style={[styles.fallbackCopy, { color: c.muted }]}>A map pin is not available for this stop yet.</Text></View>}
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

const styles = StyleSheet.create({ wrap: { overflow: 'hidden', borderWidth: 1, borderRadius:0, marginTop: 5 }, map: { height: 220, width: '100%' }, webOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 16 }, mapFallback: { minHeight: 112, padding: 15, justifyContent: 'center' }, fallbackTitle: { fontSize: 15, fontWeight: '900' }, fallbackCopy: { fontSize: 12, lineHeight: 18, marginTop: 4 }, routeMeta: { minHeight: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, routeCopy: { flex: 1 }, leg: { fontSize: 10, fontWeight: '900', letterSpacing: .8 }, distance: { fontSize: 12, fontWeight: '700', marginTop: 3 }, navigate: { borderRadius:0, paddingHorizontal: 13, paddingVertical: 10 }, navigateText: { color: 'white', fontSize: 11, fontWeight: '900' }, loader: { position: 'absolute', top: 12, right: 12 } });
