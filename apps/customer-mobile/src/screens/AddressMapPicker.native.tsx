import { AppText as Text } from '@makanza/mobile-ui';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius } from '../theme/customer';

type Coordinate = { latitude: number; longitude: number };
type Props = { point: Coordinate | null; colors: AppColors; onPick: (point: Coordinate) => void };

const leafletMapHtml = `<!doctype html>
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
        const map = L.map('map').setView([9.082, 8.6753], 6);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
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
        let marker = null;
        window.setDeliveryPin = (latitude, longitude) => {
          const position = [latitude, longitude];
          if (marker) marker.setLatLng(position);
          else marker = L.marker(position).addTo(map);
          map.setView(position, 15);
        };
        map.on('click', event => {
          const { latitude, longitude } = event.latlng;
          window.setDeliveryPin(latitude, longitude);
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'pick', latitude, longitude}));
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));
      }
    </script>
  </body>
</html>`;

const setWebMapPin = (point: Coordinate) =>
  `window.setDeliveryPin(${point.latitude},${point.longitude});true;`;

export default function AddressMapPicker({ point, colors, onPick }: Props) {
  const palette = customerPalette(colors);
  const webMap = useRef<WebView>(null);
  const pointRef = useRef(point);
  pointRef.current = point;
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!point || !mapReady) return;
    webMap.current?.injectJavaScript(setWebMapPin(point));
  }, [mapReady, point?.latitude, point?.longitude]);

  const handleWebMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; latitude?: number; longitude?: number };
    try {
      message = JSON.parse(event.nativeEvent.data) as typeof message;
    } catch {
      setMapError(true);
      return;
    }
    if (message.type === 'ready') {
      setMapReady(true);
      setMapError(false);
      if (pointRef.current) webMap.current?.injectJavaScript(setWebMapPin(pointRef.current));
    } else if (
      message.type === 'pick' &&
      typeof message.latitude === 'number' &&
      Number.isFinite(message.latitude) &&
      typeof message.longitude === 'number' &&
      Number.isFinite(message.longitude)
    ) {
      onPick({ latitude: message.latitude, longitude: message.longitude });
    } else if (message.type === 'error') {
      setMapError(true);
    }
  };

  return (
    <View style={[styles.frame, { borderColor: palette.border }]}>
      <WebView
        ref={webMap}
        style={styles.map}
        source={{ html: leafletMapHtml }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={handleWebMessage}
        onError={() => setMapError(true)}
      />
      {!mapReady && !mapError && (
        <View pointerEvents="none" style={[styles.mapLoading, { backgroundColor: palette.surface }]}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.hintText, { color: palette.ink }]}>Loading map…</Text>
        </View>
      )}
      {mapError && (
        <View pointerEvents="none" style={[styles.mapLoading, { backgroundColor: palette.surface }]}>
          <Text style={[styles.hintText, { color: palette.ink }]}>
            Map could not load. Check your internet connection.
          </Text>
        </View>
      )}
      {mapReady && !mapError && !point && (
        <View pointerEvents="none" style={[styles.hint, { backgroundColor: palette.surface }]}>
          <Text style={[styles.hintText, { color: palette.ink }]}>
            Tap the map to pin your delivery location
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 310,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: customerRadius.lg,
    marginTop: 10,
    backgroundColor: '#e8ede8',
  },
  map: { width: '100%', height: '100%' },
  hint: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    opacity: 0.96,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
