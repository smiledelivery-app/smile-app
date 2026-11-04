import { computeDrivingDistances as googleDistances, computeDrivingRoute as googleRoute, geocodeAddress as googleGeocode, GoogleMapsError, type Coordinate, type GeocodedPoint, type RouteDirections, type RouteDistance } from './google-maps.js';

export type MapProvider = 'google' | 'maplibre';
export class MapServiceError extends Error { constructor(message: string) { super(message); this.name = 'MapServiceError'; } }
export const mapProvider = (): MapProvider => process.env.MAP_PROVIDER === 'google' ? 'google' : 'maplibre';

function orsKey() { return process.env.OPENROUTESERVICE_API_KEY ?? ''; }
async function ors(path: string, body: unknown): Promise<any> {
  const key = orsKey();
  if (!key) throw new MapServiceError('OpenRouteService is not configured.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.openrouteservice.org${path}`, { method: 'POST', signal: controller.signal, headers: { Authorization: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new MapServiceError(`OpenRouteService request failed (${response.status}).`);
    return await response.json();
  } catch (error) { if (error instanceof MapServiceError) throw error; throw new MapServiceError(error instanceof Error && error.name === 'AbortError' ? 'OpenRouteService timed out.' : 'Could not reach OpenRouteService.'); }
  finally { clearTimeout(timeout); }
}
export async function routeDistances(origins: Array<{id:string;coordinate:Coordinate}>, destination: Coordinate): Promise<Map<string,RouteDistance>> {
  if (mapProvider() === 'google') return googleDistances(origins, destination, process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.MAPS_API_KEY ?? '');
  if (!origins.length) return new Map();
  const result = await ors('/ors/v2/matrix/driving-car', { locations: [...origins.map(x => [x.coordinate.longitude,x.coordinate.latitude]), [destination.longitude,destination.latitude]], sources: origins.map((_,i)=>i), destinations: [origins.length], metrics: ['distance','duration'], units: 'm' });
  return new Map(origins.flatMap((origin,i) => Number.isFinite(result.distances?.[i]?.[0]) ? [[origin.id,{distanceMeters:result.distances[i][0],durationSeconds:result.durations?.[i]?.[0] ?? null} as RouteDistance]] : []));
}
export async function drivingRoute(origin: Coordinate,destination: Coordinate): Promise<RouteDirections> {
  if (mapProvider() === 'google') return googleRoute(origin,destination,process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.MAPS_API_KEY ?? '');
  const result=await ors('/ors/v2/directions/driving-car/geojson',{coordinates:[[origin.longitude,origin.latitude],[destination.longitude,destination.latitude]],instructions:false});
  const feature=result.features?.[0], summary=feature?.properties?.summary, coordinates=feature?.geometry?.coordinates;
  if(!summary||!Array.isArray(coordinates))throw new MapServiceError('OpenRouteService could not find a driving route.');
  return {distanceMeters:summary.distance,durationSeconds:summary.duration,encodedPolyline:coordinates.map((p:number[])=>`${p[1]},${p[0]}`).join(';')};
}
export async function geocode(address:string):Promise<GeocodedPoint> {
  if(mapProvider()==='google') return googleGeocode(address,process.env.GOOGLE_MAPS_GEOCODING_API_KEY ?? process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.MAPS_API_KEY ?? '');
  const key=orsKey(); if(!key) throw new MapServiceError('OpenRouteService is not configured.');
  const url=new URL('https://api.openrouteservice.org/geocode/search'); url.searchParams.set('text',address);url.searchParams.set('boundary.country','NGA');url.searchParams.set('size','1');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10_000);
  try { const response=await fetch(url,{signal:controller.signal,headers:{Authorization:key}});if(!response.ok)throw new MapServiceError(`OpenRouteService geocoding failed (${response.status}).`);const body=await response.json() as {features?:Array<{geometry?:{coordinates?:number[]};properties?:{id?:string}}>};const p=body.features?.[0];const xy=p?.geometry?.coordinates;if(!xy||!Number.isFinite(xy[0])||!Number.isFinite(xy[1]))throw new MapServiceError('OpenRouteService could not locate that address.');return {longitude:xy[0],latitude:xy[1],placeId:p?.properties?.id??null}; }
  catch(error){if(error instanceof MapServiceError)throw error;throw new MapServiceError('Could not reach OpenRouteService geocoding.');}finally{clearTimeout(timeout);}
}
export { GoogleMapsError };
