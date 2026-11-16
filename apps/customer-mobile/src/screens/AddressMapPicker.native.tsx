import { AppText as Text } from '@makanza/mobile-ui';
import { isRunningInExpoGo } from 'expo';
import MapView, { Marker, UrlTile, type MapPressEvent, type Region } from 'react-native-maps';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { AppColors } from '../theme/colors';

type Coordinate = { latitude: number; longitude: number };
type Props = { point: Coordinate | null; colors: AppColors; onPick: (point: Coordinate) => void };

const nigeriaRegion: Region = {
  latitude: 9.082,
  longitude: 8.6753,
  latitudeDelta: 9.8,
  longitudeDelta: 12.2,
};

export default function AddressMapPicker({ point, colors, onPick }: Props) {
  const map = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const expoGo = isRunningInExpoGo();
  const initialRegion = point ? { ...point, latitudeDelta: 0.025, longitudeDelta: 0.025 } : nigeriaRegion;
  const choosePoint = (event: MapPressEvent) => onPick(event.nativeEvent.coordinate);
  useEffect(() => {
    if (point) map.current?.animateToRegion({ ...point, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
  }, [point?.latitude, point?.longitude]);
  return <View style={[styles.frame, { borderColor: colors.line }]}>
    <MapView
      ref={map}
      style={styles.map}
      initialRegion={initialRegion}
      mapType={expoGo ? 'none' : 'standard'}
      onPress={choosePoint}
      onMapReady={() => setMapReady(true)}
      loadingEnabled
      showsCompass
      toolbarEnabled={false}
    >
      {expoGo && <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19}/>}
      {point && <Marker coordinate={point} title="Delivery location" pinColor={colors.green} />}
    </MapView>
    {!mapReady && <View pointerEvents="none" style={[styles.mapLoading, { backgroundColor: colors.card }]}>
      <ActivityIndicator color={colors.green}/>
      <Text style={[styles.hintText, { color: colors.ink }]}>Loading map…</Text>
    </View>}
    {mapReady && !point && <View pointerEvents="none" style={[styles.hint, { backgroundColor: colors.card }]}>
      <Text style={[styles.hintText, { color: colors.ink }]}>Tap the map to pin your delivery location</Text>
    </View>}
    {expoGo && <View pointerEvents="none" style={[styles.attribution, { backgroundColor: colors.card }]}>
      <Text style={[styles.attributionText, { color: colors.ink }]}>© OpenStreetMap contributors</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  frame: { height: 310, overflow: 'hidden', borderWidth: 1, borderRadius: 18, marginTop: 10, backgroundColor: '#e8ede8' },
  map: { width: '100%', height: '100%' },
  hint: { position: 'absolute', top: 12, left: 12, right: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, opacity: .96 },
  mapLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hintText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  attribution: { position: 'absolute', right: 7, bottom: 6, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4, opacity: .9 },
  attributionText: { fontSize: 8 },
});
