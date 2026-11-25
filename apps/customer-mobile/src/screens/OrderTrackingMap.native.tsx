import { AppText as Text } from '@makanza/mobile-ui';
import { Bike, LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { OrderTracking } from '@makanza/mobile-core';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius } from '../theme/customer';

type Props = { tracking: OrderTracking | null; loading: boolean; error: string; colors: AppColors };
type Coordinate = { latitude: number; longitude: number };

function point(latitude: number | null | undefined, longitude: number | null | undefined): Coordinate | null {
  if (latitude == null || longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

const trackingMapHtml = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      onerror="this.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'">
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e8ede8; }
      .leaflet-container { font-family: Arial, sans-serif; }
      .custom-pin { display: flex; align-items: center; justify-content: center; }
      .pin-store { width: 34px; height: 34px; border-radius: 50%; background: #ffffff; border: 2.5px solid #228B22; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
      .pin-customer { width: 34px; height: 34px; border-radius: 50%; background: #ffffff; border: 2.5px solid #e87c59; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
      .pin-rider-wrap { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; }
      .pin-rider { width: 34px; height: 34px; border-radius: 50%; background: #228B22; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(34, 139, 34, 0.65); }
        70% { box-shadow: 0 0 0 13px rgba(34, 139, 34, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 139, 34, 0); }
      }
      .pin-rider.pulsing {
        animation: pulse 1.8s infinite;
      }
    </style>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      if (!window.L) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
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
            attribution: '&copy; OpenStreetMap &copy; CARTO'
          }).addTo(map);
        });
        tiles.addTo(map);

        const storeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#228B22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>';
        const customerSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e87c59" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
        const bikeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';

        const storeIcon = L.divIcon({
          className: 'custom-pin',
          html: '<div class="pin-store">' + storeSvg + '</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const customerIcon = L.divIcon({
          className: 'custom-pin',
          html: '<div class="pin-customer">' + customerSvg + '</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        function makeRiderIcon(pulsing) {
          return L.divIcon({
            className: 'custom-pin',
            html: '<div class="pin-rider-wrap"><div class="pin-rider' + (pulsing ? ' pulsing' : '') + '">' + bikeSvg + '</div></div>',
            iconSize: [46, 46],
            iconAnchor: [23, 23]
          });
        }

        let storeMarker = null;
        let customerMarker = null;
        let riderMarker = null;

        window.updateTrackingData = function(data) {
          if (!data) return;
          const points = [];

          if (data.vendor && typeof data.vendor.latitude === 'number' && typeof data.vendor.longitude === 'number') {
            const pos = [data.vendor.latitude, data.vendor.longitude];
            points.push(pos);
            if (!storeMarker) {
              storeMarker = L.marker(pos, { icon: storeIcon }).addTo(map);
            } else {
              storeMarker.setLatLng(pos);
            }
          } else if (storeMarker) {
            map.removeLayer(storeMarker);
            storeMarker = null;
          }

          if (data.customer && typeof data.customer.latitude === 'number' && typeof data.customer.longitude === 'number') {
            const pos = [data.customer.latitude, data.customer.longitude];
            points.push(pos);
            if (!customerMarker) {
              customerMarker = L.marker(pos, { icon: customerIcon }).addTo(map);
            } else {
              customerMarker.setLatLng(pos);
            }
          } else if (customerMarker) {
            map.removeLayer(customerMarker);
            customerMarker = null;
          }

          if (data.rider && typeof data.rider.latitude === 'number' && typeof data.rider.longitude === 'number') {
            const pos = [data.rider.latitude, data.rider.longitude];
            points.push(pos);
            const icon = makeRiderIcon(!!data.recent);
            if (!riderMarker) {
              riderMarker = L.marker(pos, { icon: icon }).addTo(map);
            } else {
              riderMarker.setLatLng(pos);
              riderMarker.setIcon(icon);
            }
          } else if (riderMarker) {
            map.removeLayer(riderMarker);
            riderMarker = null;
          }

          if (points.length > 1) {
            map.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 16 });
          } else if (points.length === 1) {
            map.setView(points[0], 15);
          }
        };

        window.recenterMap = function() {
          const points = [];
          if (riderMarker) points.push(riderMarker.getLatLng());
          if (customerMarker) points.push(customerMarker.getLatLng());
          if (storeMarker) points.push(storeMarker.getLatLng());

          if (points.length > 1) {
            map.fitBounds(L.latLngBounds(points), { padding: [55, 55], maxZoom: 16 });
          } else if (points.length === 1) {
            map.setView(points[0], 15);
          }
        };

        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      }
    </script>
  </body>
</html>`;

export default function OrderTrackingMap({ tracking, loading, error, colors: c }: Props) {
  const p = customerPalette(c);
  const webMap = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const vendor = point(tracking?.vendor?.latitude, tracking?.vendor?.longitude);
  const customer = point(tracking?.customer?.latitude, tracking?.customer?.longitude);
  const rider = point(tracking?.rider?.latitude, tracking?.rider?.longitude);
  const isPickedUp = tracking?.deliveryStatus === 'PICKED_UP';

  const hasPins = !!(vendor || customer || rider);

  const locationAge = tracking?.rider?.updatedAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(tracking.rider.updatedAt)) / 1000))
    : null;
  const recent = locationAge !== null && locationAge < 120;

  const trackingPayload = useMemo(
    () => ({
      vendor,
      customer,
      rider,
      recent,
      vendorName: tracking?.vendor?.name ?? 'Restaurant',
    }),
    [
      vendor?.latitude,
      vendor?.longitude,
      customer?.latitude,
      customer?.longitude,
      rider?.latitude,
      rider?.longitude,
      recent,
      tracking?.vendor?.name,
    ]
  );

  const payloadRef = useRef(trackingPayload);
  payloadRef.current = trackingPayload;

  useEffect(() => {
    if (!mapReady || !hasPins) return;
    webMap.current?.injectJavaScript(
      `window.updateTrackingData(${JSON.stringify(trackingPayload)});true;`
    );
  }, [mapReady, hasPins, trackingPayload]);

  const recenter = () => {
    webMap.current?.injectJavaScript('window.recenterMap();true;');
  };

  const handleWebMessage = (event: WebViewMessageEvent) => {
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
      if (payloadRef.current) {
        webMap.current?.injectJavaScript(
          `window.updateTrackingData(${JSON.stringify(payloadRef.current)});true;`
        );
      }
    } else if (message.type === 'error') {
      setMapError(true);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      <View style={styles.mapFrame}>
        {hasPins ? (
          <>
            <WebView
              ref={webMap}
              style={StyleSheet.absoluteFill}
              source={{ html: trackingMapHtml }}
              originWhitelist={['*']}
              javaScriptEnabled
              onMessage={handleWebMessage}
              onError={() => setMapError(true)}
            />
            {!mapReady && !mapError && (
              <View pointerEvents="none" style={[styles.loadingOverlay, { backgroundColor: p.surface }]}>
                <ActivityIndicator color={p.primary} />
                <Text style={[styles.captionSub, { color: p.ink }]}>Loading tracking map…</Text>
              </View>
            )}
            {mapError && (
              <View pointerEvents="none" style={[styles.loadingOverlay, { backgroundColor: p.surface }]}>
                <Text style={[styles.captionSub, { color: p.ink }]}>
                  Map could not load. Check your internet connection.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.noMap, { backgroundColor: p.surfaceAlt }]}>
            <View style={[styles.noMapIcon, { backgroundColor: p.primarySoft }]}>
              <MapPin size={24} color={p.primary} />
            </View>
            <Text style={[styles.noMapTitle, { color: p.ink }]}>Your delivery map</Text>
            <Text style={[styles.noMapCopy, { color: p.muted }]}>
              Map pins are not available for this order yet.
            </Text>
          </View>
        )}

        {hasPins && (
          <>
            <View style={[styles.mapTopPill, { backgroundColor: p.surface }]}>
              <View style={[styles.liveDot, { backgroundColor: rider && recent ? '#20a36b' : p.muted }]} />
              <Text style={[styles.mapTopText, { color: p.ink }]}>
                {rider && recent ? 'LIVE TRACKING' : rider ? 'LAST KNOWN LOCATION' : 'RIDER ON THE WAY'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Recenter delivery map"
              onPress={recenter}
              style={[styles.recenter, { backgroundColor: p.surface }]}
            >
              <LocateFixed size={19} color={p.ink} />
            </Pressable>
            <View style={[styles.mapCaption, { backgroundColor: p.surface }]}>
              <Text style={[styles.captionText, { color: p.ink }]}>
                {isPickedUp ? 'Heading to you' : 'Going to restaurant'}
              </Text>
              <Text style={[styles.captionSub, { color: p.muted }]}>
                {isPickedUp
                  ? 'Your rider has picked up the order'
                  : 'Your rider is heading to the pickup'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.details}>
        <View style={[styles.riderAvatar, { backgroundColor: p.primarySoft }]}>
          <Bike size={21} color={p.primary} />
        </View>
        <View style={styles.detailCopy}>
          <Text style={[styles.detailTitle, { color: c.ink }]}>
            {tracking?.rider
              ? isPickedUp
                ? 'Your order is on the way'
                : 'Your rider is heading to pickup'
              : 'Finding your rider'}
          </Text>
          <Text style={[styles.detailSub, { color: c.muted }]}>
            {tracking?.rider
              ? `${tracking.vendor.name} · ${locationAge === 0 ? 'Updated just now' : `Updated ${locationAge}s ago`}`
              : loading
                ? 'Waiting for rider location…'
                : error || 'Live location will appear when available.'}
          </Text>
        </View>
        {tracking?.rider && (
          <View
            style={[
              styles.statusChip,
              { backgroundColor: recent ? p.primarySoft : p.surfaceAlt },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: recent ? p.primary : p.muted },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: recent ? p.primary : p.muted },
              ]}
            >
              {recent ? 'LIVE' : 'UPDATING'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: customerRadius.lg, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  mapFrame: { height: 300, overflow: 'hidden' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noMap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  noMapIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  noMapTitle: { fontSize: 16, fontWeight: '900' },
  noMapCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  mapTopPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    elevation: 3,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  mapTopText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.65 },
  recenter: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  mapCaption: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
    elevation: 3,
  },
  captionText: { fontSize: 13, fontWeight: '900' },
  captionSub: { fontSize: 11, marginTop: 2 },
  details: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 11,
  },
  riderAvatar: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1 },
  detailTitle: { fontSize: 13, fontWeight: '900' },
  detailSub: { fontSize: 11, marginTop: 4 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});
