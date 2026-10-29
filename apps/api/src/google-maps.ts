export type Coordinate = { latitude: number; longitude: number };
export type RouteDistance = { distanceMeters: number; durationSeconds: number | null };
export type RouteDirections = RouteDistance & { encodedPolyline: string };
export type GeocodedPoint = Coordinate & { placeId: string | null };

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  condition?: string;
  status?: { code?: number; message?: string };
  distanceMeters?: number;
  duration?: string;
};

export class GoogleMapsError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; this.name = 'GoogleMapsError'; }
}

function location(point: Coordinate) {
  return { waypoint: { location: { latLng: point } } };
}

function parseSeconds(value?: string) {
  if (!value) return null;
  const seconds = Number.parseFloat(value.replace(/s$/, ''));
  return Number.isFinite(seconds) ? seconds : null;
}

async function readElements(response: Response): Promise<MatrixElement[]> {
  const text = await response.text();
  if (!response.ok) throw new GoogleMapsError(`Routes API request failed (${response.status}).`, response.status);
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as MatrixElement[];
    if (parsed && typeof parsed === 'object' && 'error' in parsed) throw new GoogleMapsError('Routes API returned an error.');
    if (parsed && typeof parsed === 'object' && 'originIndex' in parsed) return [parsed as MatrixElement];
  } catch (error) {
    if (error instanceof GoogleMapsError) throw error;
    const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    try { return rows.map(row => JSON.parse(row) as MatrixElement); }
    catch { throw new GoogleMapsError('Routes API returned an unreadable response.'); }
  }
  throw new GoogleMapsError('Routes API returned an unexpected response.');
}

export async function computeDrivingDistances(
  origins: Array<{ id: string; coordinate: Coordinate }>,
  destination: Coordinate,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<Map<string, RouteDistance>> {
  if (!apiKey.trim()) throw new GoogleMapsError('Google Maps Routes API key is not configured.');
  if (!origins.length) return new Map();
  if (origins.length > 49) throw new RangeError('Route matrix supports at most 49 rider origins for one pickup destination.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration',
      },
      body: JSON.stringify({
        origins: origins.map(origin => location(origin.coordinate)),
        destinations: [location(destination)],
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        units: 'METRIC',
      }),
    });
    const elements = await readElements(response);
    const result = new Map<string, RouteDistance>();
    for (const element of elements) {
      const origin = origins[element.originIndex ?? -1];
      if (!origin || element.destinationIndex !== 0 || element.status?.code && element.status.code !== 0 || element.condition && element.condition !== 'ROUTE_EXISTS') continue;
      if (!Number.isFinite(element.distanceMeters) || (element.distanceMeters ?? -1) < 0) continue;
      result.set(origin.id, { distanceMeters: element.distanceMeters!, durationSeconds: parseSeconds(element.duration) });
    }
    return result;
  } catch (error) {
    if (error instanceof GoogleMapsError || error instanceof RangeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new GoogleMapsError('Google Maps Routes API timed out.');
    throw new GoogleMapsError('Could not reach Google Maps Routes API.');
  } finally { clearTimeout(timeout); }
}

export async function computeDrivingRoute(
  origin: Coordinate,
  destination: Coordinate,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<RouteDirections> {
  if (!apiKey.trim()) throw new GoogleMapsError('Google Maps Routes API key is not configured.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        languageCode: 'en',
        units: 'METRIC',
      }),
    });
    const body = await response.json().catch(() => null) as { routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }> } | null;
    if (!response.ok) throw new GoogleMapsError(`Routes API request failed (${response.status}).`, response.status);
    const route = body?.routes?.[0];
    if (!route || !Number.isFinite(route.distanceMeters) || !route.polyline?.encodedPolyline) throw new GoogleMapsError('Google Maps could not find a driving route.');
    return { distanceMeters: route.distanceMeters!, durationSeconds: parseSeconds(route.duration), encodedPolyline: route.polyline.encodedPolyline };
  } catch (error) {
    if (error instanceof GoogleMapsError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new GoogleMapsError('Google Maps Routes API timed out.');
    throw new GoogleMapsError('Could not reach Google Maps Routes API.');
  } finally { clearTimeout(timeout); }
}

export async function geocodeAddress(address: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<GeocodedPoint> {
  if (!apiKey.trim()) throw new GoogleMapsError('Google Maps Geocoding API key is not configured.');
  const url = new URL(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}`);
  url.searchParams.set('regionCode', 'NG');
  url.searchParams.set('languageCode', 'en');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'results.location,results.placeId' } });
    const body = await response.json().catch(() => null) as { results?: Array<{ location?: Coordinate; placeId?: string }> } | null;
    if (!response.ok) throw new GoogleMapsError(`Geocoding API request failed (${response.status}).`, response.status);
    const point = body?.results?.[0];
    if (!point?.location || !Number.isFinite(point.location.latitude) || !Number.isFinite(point.location.longitude)) throw new GoogleMapsError('Google Maps could not locate that address.');
    return { ...point.location, placeId: point.placeId ?? null };
  } catch (error) {
    if (error instanceof GoogleMapsError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new GoogleMapsError('Google Maps Geocoding API timed out.');
    throw new GoogleMapsError('Could not reach Google Maps Geocoding API.');
  } finally { clearTimeout(timeout); }
}
