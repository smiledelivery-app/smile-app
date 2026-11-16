import { autocompletePlaces, computeDrivingDistances, computeDrivingRoute, geocodeAddress, GoogleMapsError, resolvePlace, type Coordinate, type GeocodedPoint, type PlaceSuggestion, type ResolvedPlace, type RouteDirections, type RouteDistance } from './google-maps.js';

const configuredKey = (...values: Array<string | undefined>) => values.map(value => value?.trim()).find(Boolean) ?? '';
const routesKey = () => configuredKey(process.env.GOOGLE_MAPS_ROUTES_API_KEY, process.env.MAPS_API_KEY);
const geocodingKey = () => configuredKey(process.env.GOOGLE_MAPS_GEOCODING_API_KEY, process.env.GOOGLE_MAPS_ROUTES_API_KEY, process.env.MAPS_API_KEY);
const placesKey = () => configuredKey(process.env.GOOGLE_MAPS_PLACES_API_KEY, process.env.GOOGLE_MAPS_GEOCODING_API_KEY, process.env.GOOGLE_MAPS_ROUTES_API_KEY, process.env.MAPS_API_KEY);

export const routesConfigured = () => Boolean(routesKey());
export const geocodingConfigured = () => Boolean(geocodingKey());
export const placesConfigured = () => Boolean(placesKey());

export async function routeDistances(origins: Array<{id:string;coordinate:Coordinate}>, destination: Coordinate): Promise<Map<string,RouteDistance>> {
  return computeDrivingDistances(origins, destination, routesKey());
}

export async function drivingRoute(origin: Coordinate,destination: Coordinate): Promise<RouteDirections> {
  return computeDrivingRoute(origin, destination, routesKey());
}

export async function geocode(address:string):Promise<GeocodedPoint> {
  return geocodeAddress(address, geocodingKey());
}

export async function suggestPlaces(input:string):Promise<PlaceSuggestion[]> {
  return autocompletePlaces(input, placesKey());
}

export async function resolveAddressPlace(placeId:string):Promise<ResolvedPlace> {
  return resolvePlace(placeId, placesKey());
}

export { GoogleMapsError };
