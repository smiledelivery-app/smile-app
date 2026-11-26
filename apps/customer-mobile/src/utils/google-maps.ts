import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type EmbeddedConfig = {
  android?: { config?: { googleMaps?: { apiKey?: string } } };
  ios?: { config?: { googleMapsApiKey?: string } };
  extra?: { googleMapsConfigured?: { android?: boolean; ios?: boolean } };
};

type ExponentConstantsModule = {
  manifest?: string | EmbeddedConfig;
};

let cachedAvailability: boolean | null = null;

/**
 * Checks whether the installed native binary has Google Maps SDK configured.
 * Reads the embedded binary config (ExponentConstants.manifest) so OTA updates
 * cannot mount MapView on a native binary built without an API key.
 */
export function hasNativeGoogleMapsSdk(): boolean {
  if (cachedAvailability !== null) return cachedAvailability;
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    cachedAvailability = false;
    return false;
  }
  if (isRunningInExpoGo()) {
    cachedAvailability = Platform.OS === 'android';
    return cachedAvailability;
  }
  try {
    const constants = requireOptionalNativeModule<ExponentConstantsModule>('ExponentConstants');
    const raw = constants?.manifest;
    const config: EmbeddedConfig | null =
      typeof raw === 'string' ? (JSON.parse(raw) as EmbeddedConfig) : (raw ?? null);
    if (Platform.OS === 'android') {
      cachedAvailability = Boolean(
        config?.extra?.googleMapsConfigured?.android ?? config?.android?.config?.googleMaps?.apiKey
      );
      return cachedAvailability;
    }
    cachedAvailability = Boolean(
      config?.extra?.googleMapsConfigured?.ios ?? config?.ios?.config?.googleMapsApiKey
    );
    return cachedAvailability;
  } catch {
    cachedAvailability = false;
    return false;
  }
}
