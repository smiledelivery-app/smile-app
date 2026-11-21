import { AppTextInput as TextInput } from '@makanza/mobile-ui';
import { AppText as Text } from '@makanza/mobile-ui';
import { ApiError } from '@makanza/mobile-core';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../components/AppIcon';
import { api } from '../services/api';
import type { AppColors } from '../theme/colors';
import { customerPalette, customerRadius, customerSpace } from '../theme/customer';
import AddressMapPicker from './AddressMapPicker';

export type SavedAddress = { id: string; label: string; line1: string; city: string; latitude: number | string | null; longitude: number | string | null };
type PlaceSuggestion = { placeId: string; description: string };
type ResolvedPlace = { line1: string; city: string; latitude: number; longitude: number };
type Coordinate = { latitude: number; longitude: number };
type Props = { visible: boolean; token: string | null; colors: AppColors; manageMode?: boolean; onClose: () => void; onSelect: (address: SavedAddress) => void; onSignIn: () => void };
const quickLabels = ['Home', 'Work', "Mum's place", 'Other'];
const hasPin = (place: SavedAddress) => place.latitude !== null && place.longitude !== null;

export default function AddressPickerModal({ visible, token, colors: c, manageMode = false, onClose, onSelect, onSignIn }: Props) {
  const [places, setPlaces] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [label, setLabel] = useState('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState<Coordinate | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resolving, setResolving] = useState(false);
  const s = styles(c);
  const p = customerPalette(c);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setPlaces(await api.get<SavedAddress[]>('/addresses', token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load saved places.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && token) void load();
    if (!visible) {
      setFormOpen(false);
      setEditing(null);
      setError('');
      setSearchError('');
      setLocationQuery('');
      setSuggestions([]);
    }
  }, [visible, token]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (!visible || !formOpen || !token || !searchEnabled || query.length < 3) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSuggestionsLoading(true);
      setSearchError('');
      void api.get<PlaceSuggestion[]>(`/addresses/suggestions?q=${encodeURIComponent(query)}`, token)
        .then(rows => { if (active) setSuggestions(rows); })
        .catch(reason => {
          if (active) {
            setSuggestions([]);
            setSearchError(reason instanceof ApiError && reason.code === 'NOT_FOUND'
              ? 'Place search is not available on this API yet. Restart the local API or deploy the updated API.'
              : reason instanceof Error ? reason.message : 'Could not search Nigerian locations.');
          }
        })
        .finally(() => { if (active) setSuggestionsLoading(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [visible, formOpen, token, locationQuery, searchEnabled]);

  const startNew = () => {
    setEditing(null);
    setLabel('Home');
    setCustomLabel('');
    setLine1('');
    setCity('');
    setPin(null);
    setLocationQuery('');
    setSearchEnabled(false);
    setSuggestions([]);
    setSearchError('');
    setFormOpen(true);
  };

  const startEdit = (place: SavedAddress) => {
    setEditing(place);
    setLabel(quickLabels.includes(place.label) ? place.label : 'Other');
    setCustomLabel(quickLabels.includes(place.label) ? '' : place.label);
    setLine1(place.line1);
    setCity(place.city);
    setPin(hasPin(place) ? { latitude: Number(place.latitude), longitude: Number(place.longitude) } : null);
    setLocationQuery(hasPin(place) ? `${place.line1}, ${place.city}` : '');
    setSearchEnabled(false);
    setSuggestions([]);
    setSearchError(hasPin(place) ? '' : 'Choose a search result or pin this saved place on the map before saving.');
    setFormOpen(true);
  };

  const useCurrentLocation = async () => {
    setError('');
    setSaving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Allow location access to use your current location.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(current.coords);
      const street = [place?.streetNumber, place?.street, place?.name].filter(Boolean).join(' ')
        || `Current location (${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)})`;
      const currentCity = place?.city || place?.district || place?.region || 'Lagos';
      const currentPin = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      if (!token) {
        onSelect({ id: 'device-current-location', label: 'Current location', line1: street, city: currentCity, ...currentPin });
        onClose();
        return;
      }
      setLabel('Other');
      setCustomLabel('Current location');
      setEditing(null);
      setLine1(street);
      setCity(currentCity);
      setPin(currentPin);
      setLocationQuery(`${street}, ${currentCity}`);
      setSearchEnabled(false);
      setFormOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not get your current location. Check location permission.');
    } finally {
      setSaving(false);
    }
  };

  const chooseSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!token) return;
    setResolving(true);
    setSearchError('');
    setSearchEnabled(false);
    setSuggestions([]);
    try {
      const result = await api.post<ResolvedPlace>('/addresses/resolve', { placeId: suggestion.placeId }, token);
      setLine1(result.line1);
      setCity(result.city);
      setPin({ latitude: result.latitude, longitude: result.longitude });
      setLocationQuery(suggestion.description);
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : 'Could not load that location.');
    } finally {
      setResolving(false);
    }
  };

  const chooseMapPoint = async (coordinate: Coordinate) => {
    const inNigeria = coordinate.latitude >= 4.2 && coordinate.latitude <= 13.95
      && coordinate.longitude >= 2.6 && coordinate.longitude <= 14.7;
    if (!inNigeria) {
      setSearchError('Choose a point within Nigeria.');
      return;
    }
    setSaving(true);
    setSearchError('');
    try {
      const [place] = await Location.reverseGeocodeAsync(coordinate);
      const country = place?.isoCountryCode?.toUpperCase();
      if (!place || (country !== 'NG' && place.country?.toLowerCase() !== 'nigeria')) {
        throw new Error('Choose a point within Nigeria.');
      }
      const addressLine = [place.streetNumber, place.street, place.name].filter(Boolean).join(' ')
        || `Map pin (${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)})`;
      const addressCity = place.city || place.district || place.region;
      if (!addressCity) throw new Error('Could not read the area at this pin. Move the pin closer to a street.');
      setLine1(addressLine);
      setCity(addressCity);
      setPin(coordinate);
      setLocationQuery(`${addressLine}, ${addressCity}`);
      setSearchEnabled(false);
      setSuggestions([]);
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : 'Could not resolve this map pin.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const name = label === 'Other' ? customLabel.trim() : label;
    if (!name) {
      setError('Give this saved place a name.');
      return;
    }
    if (!pin || line1.trim().length < 3 || city.trim().length < 2) {
      setError('Choose a location from the suggestions or pin it on the map before saving.');
      return;
    }
    if (!token) {
      onSignIn();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { label: name, line1: line1.trim(), city: city.trim(), ...pin };
      const saved = editing
        ? await api.patch<SavedAddress>(`/addresses/${encodeURIComponent(editing.id)}`, body, token)
        : await api.post<SavedAddress>('/addresses', body, token);
      await load();
      setFormOpen(false);
      if (!manageMode) {
        onSelect(saved);
        onClose();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this place.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (place: SavedAddress) => {
    const confirm = async () => {
      if (!token) return;
      setError('');
      try {
        await api.delete(`/addresses/${encodeURIComponent(place.id)}`, token);
        await load();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not remove this place.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove ${place.label} from your saved places?`)) void confirm();
      return;
    }
    Alert.alert('Remove saved place?', `Remove ${place.label} from your saved places?`, [
      { text: 'Keep place', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void confirm() },
    ]);
  };

  const chooseSavedPlace = (place: SavedAddress) => {
    if (manageMode) return;
    if (!hasPin(place)) {
      startEdit(place);
      return;
    }
    onSelect(place);
    onClose();
  };

  if (!visible) return null;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {formOpen ? <SafeAreaView style={s.fullScreen}>
      <View style={s.formHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to saved places" onPress={() => setFormOpen(false)} style={s.iconButton}>
          <Ionicons name="chevron-back" size={22} color={c.ink}/>
        </Pressable>
        <View style={s.formHeaderCopy}>
          <Text style={s.kicker}>DELIVERY LOCATION</Text>
          <Text style={s.formTitle}>{editing ? 'Edit saved place' : 'Set your drop-off point'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close location picker" onPress={onClose} style={s.iconButton}>
          <Ionicons name="close" size={22} color={c.ink}/>
        </Pressable>
      </View>
      <ScrollView style={s.formScroll} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={20} color={p.primary}/>
          <TextInput
            value={locationQuery}
            onChangeText={(value: string) => {
              setLocationQuery(value);
              setPin(null);
              setLine1('');
              setCity('');
              setSearchEnabled(true);
              setSearchError('');
              setError('');
              setSuggestions([]);
            }}
            placeholder="Search street, landmark or area"
            placeholderTextColor={c.muted}
            style={s.searchInput}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {suggestionsLoading || resolving ? <ActivityIndicator color={p.primary}/> : null}
        </View>
        {suggestions.length > 0 && <View style={s.suggestions}>
          {suggestions.map((item, index) => <Pressable
            key={item.placeId}
            accessibilityRole="button"
            onPress={() => void chooseSuggestion(item)}
            style={[s.suggestion, index < suggestions.length - 1 && s.suggestionBorder]}
          >
            <View style={s.suggestionIcon}><Ionicons name="location-outline" size={18} color={p.primary}/></View>
            <Text style={s.suggestionText}>{item.description}</Text>
            <Ionicons name="chevron-forward" size={17} color={c.muted}/>
          </Pressable>)}
        </View>}
        <Text style={s.instruction}>Choose a search result or tap the map. A precise pin is required.</Text>
        <AddressMapPicker point={pin} colors={c} onPick={point => void chooseMapPoint(point)}/>
        {searchError ? <Text style={s.error}>{searchError}</Text> : null}
        {pin && <View style={s.selectedLocation}>
          <View style={s.selectedIcon}><Ionicons name="checkmark" size={17} color="white"/></View>
          <View style={s.selectedCopy}>
            <Text style={s.selectedTitle}>Pinned location</Text>
            <Text style={s.selectedAddress}>{line1}, {city}</Text>
          </View>
          <Text style={s.coordinates}>{pin.latitude.toFixed(4)} · {pin.longitude.toFixed(4)}</Text>
        </View>}
        <Text style={s.fieldLabel}>Save this place as</Text>
        <View style={s.labelChips}>{quickLabels.map(item => <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: label === item }}
          onPress={() => setLabel(item)}
          style={[s.chip, label === item && s.chipActive]}
        ><Text style={[s.chipText, label === item && s.chipTextActive]}>{item}</Text></Pressable>)}</View>
        {label === 'Other' && <TextInput
          value={customLabel}
          onChangeText={setCustomLabel}
          placeholder="Name this place"
          placeholderTextColor={c.muted}
          style={s.nameInput}
          autoCapitalize="words"
        />}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
      <View style={s.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || resolving || !pin}
          onPress={() => void save()}
          style={[s.saveButton, (saving || resolving || !pin) && s.saveDisabled]}
        >
          {saving ? <ActivityIndicator color="white"/> : <Text style={s.saveText}>{editing ? 'Save changes' : 'Save delivery location'}</Text>}
        </Pressable>
      </View>
    </SafeAreaView> : <View style={s.backdrop}>
      <View style={s.sheet}>
        <View style={s.grabber}/>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Text style={s.kicker}>{manageMode ? 'YOUR PLACES' : 'DELIVERY LOCATION'}</Text>
            <Text style={s.title}>Where should we deliver?</Text>
            <Text style={s.headerSub}>{manageMode ? 'Manage your saved places' : 'Choose a saved place or set a new pinned location'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close address picker" onPress={onClose} style={s.iconButton}>
            <Ionicons name="close" size={22} color={c.ink}/>
          </Pressable>
        </View>
        {!manageMode && <Pressable disabled={saving} onPress={() => void useCurrentLocation()} style={s.current}>
          <View style={s.currentIcon}><Ionicons name="navigate" size={20} color={p.primary}/></View>
          <View style={s.placeCopy}>
            <Text style={s.placeTitle}>{saving ? 'Finding your location…' : 'Use my current location'}</Text>
            <Text style={s.body}>Pin your device’s current position</Text>
          </View>
          {saving ? <ActivityIndicator color={p.primary}/> : <Ionicons name="chevron-forward" size={18} color={p.primary}/>}
        </Pressable>}
        {token && <Pressable onPress={startNew} style={s.add}>
          <View style={s.addIcon}><Ionicons name="add" size={22} color={p.primary}/></View>
          <Text style={s.addText}>Add a delivery place</Text>
          <Ionicons name="chevron-forward" size={18} color={p.primary}/>
        </Pressable>}
        <Text style={s.savedHeading}>{manageMode ? 'SAVED PLACES' : 'SAVED DELIVERY PLACES'}</Text>
        {loading ? <ActivityIndicator color={p.primary} style={s.loading}/> : error ? <Text style={s.error}>{error}</Text>
          : places.length === 0 ? <View style={s.empty}>
            <View style={s.emptyIcon}><Ionicons name="map-outline" size={24} color={p.primary}/></View>
            <Text style={s.emptyTitle}>No saved places yet</Text>
            <Text style={s.body}>Add a place and choose its exact location on the map.</Text>
          </View>
          : <ScrollView style={s.list} keyboardShouldPersistTaps="handled">{places.map(place => <View key={place.id} style={s.placeRow}>
            <Pressable accessibilityRole="button" onPress={() => chooseSavedPlace(place)} style={s.placeSelect}>
              <View style={s.placeIcon}><Ionicons name={place.label.toLowerCase().includes('home') ? 'home-outline' : place.label.toLowerCase().includes('work') ? 'briefcase-outline' : 'location-outline'} size={19} color={p.primary}/></View>
              <View style={s.placeCopy}>
                <Text style={s.placeTitle}>{place.label}</Text>
                <Text style={s.body} numberOfLines={2}>{place.line1}, {place.city}</Text>
                {!hasPin(place) && <Text style={s.pinRequired}>Needs a map pin</Text>}
              </View>
              {!manageMode && <Ionicons name="chevron-forward" size={18} color={c.muted}/>}
            </Pressable>
            {manageMode && <View style={s.placeActions}>
              <Pressable accessibilityRole="button" onPress={() => startEdit(place)}><Text style={s.link}>Edit</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => remove(place)}><Text style={s.remove}>Remove</Text></Pressable>
            </View>}
          </View>)}</ScrollView>}
      </View>
    </View>}
  </Modal>;
}

const styles = (colors: AppColors) => {
  const c = customerPalette(colors);
  return StyleSheet.create({
    fullScreen: { flex: 1, backgroundColor: c.canvas },
    formHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: customerSpace.lg, borderBottomWidth: 1, borderBottomColor: c.border },
    formHeaderCopy: { flex: 1 },
    formTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: c.ink, marginTop: 2 },
    iconButton: { width: 42, height: 42, borderRadius: customerRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    formScroll: { flex: 1 },
    formContent: { padding: customerSpace.lg, paddingBottom: customerSpace.xl },
    searchWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: customerRadius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    searchInput: { flex: 1, height: 52, color: c.ink, fontSize: 14 },
    suggestions: { marginTop: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: c.border, borderRadius: customerRadius.md, backgroundColor: c.surface },
    suggestion: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
    suggestionBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    suggestionIcon: { width: 36, height: 36, borderRadius: customerRadius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    suggestionText: { flex: 1, fontSize: 12, lineHeight: 18, color: c.ink },
    instruction: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: c.muted, marginTop: 16, marginBottom: 2 },
    selectedLocation: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: customerRadius.md, backgroundColor: c.primarySoft },
    selectedIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    selectedCopy: { flex: 1 },
    selectedTitle: { fontSize: 11, fontWeight: '900', color: c.primary },
    selectedAddress: { fontSize: 12, lineHeight: 17, color: c.ink, marginTop: 2 },
    coordinates: { fontSize: 9, color: c.muted },
    fieldLabel: { fontSize: 12, fontWeight: '900', color: c.ink, marginTop: 18, marginBottom: 9 },
    labelChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: customerRadius.pill, backgroundColor: c.surfaceAlt },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 11, fontWeight: '800', color: c.ink },
    chipTextActive: { color: 'white' },
    nameInput: { minHeight: 50, borderWidth: 1, borderColor: c.border, borderRadius: customerRadius.sm, backgroundColor: c.surface, color: c.ink, paddingHorizontal: 13, fontSize: 14, marginTop: 10 },
    footer: { paddingHorizontal: customerSpace.lg, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.canvas },
    saveButton: { minHeight: 52, borderRadius: customerRadius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
    saveDisabled: { opacity: .48 },
    saveText: { fontSize: 13, fontWeight: '900', color: 'white' },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,25,17,.48)' },
    sheet: { maxHeight: '88%', backgroundColor: c.canvas, borderTopLeftRadius: customerRadius.xl, borderTopRightRadius: customerRadius.xl, paddingHorizontal: customerSpace.lg, paddingTop: 9, paddingBottom: customerSpace.xl },
    grabber: { width: 38, height: 4, borderRadius: 4, backgroundColor: c.border, alignSelf: 'center', marginBottom: 15 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    headerCopy: { flex: 1 },
    kicker: { fontSize: 9, letterSpacing: 1.15, fontWeight: '900', color: c.primary },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -.5, color: c.ink, marginTop: 5 },
    headerSub: { fontSize: 11, lineHeight: 16, color: c.muted, marginTop: 4 },
    current: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: customerRadius.md, backgroundColor: c.primarySoft, marginBottom: 9 },
    currentIcon: { width: 42, height: 42, borderRadius: customerRadius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    placeCopy: { flex: 1, gap: 3 },
    placeTitle: { fontSize: 13, fontWeight: '900', color: c.ink },
    body: { fontSize: 11, lineHeight: 16, color: c.muted },
    add: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: customerRadius.md, backgroundColor: c.surface, marginBottom: 18 },
    addIcon: { width: 36, height: 36, borderRadius: customerRadius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    addText: { flex: 1, fontSize: 12, fontWeight: '900', color: c.primary },
    savedHeading: { fontSize: 9, letterSpacing: 1, fontWeight: '900', color: c.muted, marginBottom: 9 },
    list: { maxHeight: 300 },
    placeRow: { paddingHorizontal: 10, borderWidth: 1, borderColor: c.border, borderRadius: customerRadius.md, backgroundColor: c.surface, marginBottom: 8 },
    placeSelect: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
    placeIcon: { width: 38, height: 38, borderRadius: customerRadius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt },
    pinRequired: { fontSize: 10, fontWeight: '800', color: c.danger, marginTop: 3 },
    placeActions: { flexDirection: 'row', gap: 18, paddingLeft: 49, paddingBottom: 10 },
    link: { fontSize: 11, fontWeight: '900', color: c.primary },
    remove: { fontSize: 11, fontWeight: '900', color: c.danger },
    loading: { margin: 22 },
    empty: { alignItems: 'center', gap: 7, padding: 18 },
    emptyIcon: { width: 48, height: 48, borderRadius: customerRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
    emptyTitle: { fontSize: 13, fontWeight: '900', color: c.ink },
    error: { fontSize: 11, lineHeight: 17, color: c.danger, marginTop: 9 },
  });
};
