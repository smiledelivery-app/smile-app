# Mapping providers

## Current integration status

`apps/api/src/google-maps.ts` remains intact. Server routing, route matrices and geocoding now go through `apps/api/src/map-provider.ts`. `MAP_PROVIDER=maplibre` (the default) uses OpenRouteService; `MAP_PROVIDER=google` selects the existing Google services. The OpenRouteService key is read only by the API process.

The Expo apps use React Native 0.86 with the new architecture enabled. MapLibre React Native v11 supports RN 0.80+ and requires a custom development build; it does not run in Expo Go and has no web renderer. The Next.js/web renderer needs MapLibre GL JS. Both native packages and the Expo config plugins are declared, but installation/build verification remains pending.

The existing native Google map components are preserved. `EXPO_PUBLIC_MAP_PROVIDER` is public renderer configuration; set it to `google` only when Google SDK keys are configured in the native build. Never put the OpenRouteService key in an Expo or Next public variable.

## Configuration

API `.env`:

```dotenv
MAP_PROVIDER=maplibre
OPENROUTESERVICE_API_KEY=your-server-side-key
```

Use `MAP_PROVIDER=google` with the existing `GOOGLE_MAPS_ROUTES_API_KEY` and `GOOGLE_MAPS_GEOCODING_API_KEY` to select Google services. Google environment variables and implementations are retained.

Mobile build environment:

```dotenv
EXPO_PUBLIC_MAP_PROVIDER=maplibre
```

The API responds with `provider` and `geometryFormat` on rider directions. OpenRouteService directions return line geometry as semicolon-separated `latitude,longitude` pairs; Google returns an encoded polyline. Consumers must branch on `geometryFormat`.

## Known gaps

- MapLibre dependencies/configuration are declared, but dependency installation and native builds are unverified. The map screens have not yet been switched to MapLibre rendering; existing Google renderer remains available.
- The web tracking and operations screens remain their existing placeholders. Add MapLibre GL JS components before claiming web map rendering.
- Rider coordinates use the existing authenticated HTTP endpoint and polling. There is no Socket.IO implementation in this repo, so this change does not claim push tracking or background location.
- PostgreSQL stores coordinates in decimal columns. PostGIS is not enabled in the schema or migrations; enabling it needs a database with the extension installed and a verified migration.
- OpenRouteService geocoding is used on write/refresh paths. Address autocomplete/search, response caching, and provider-specific geocode retention/policy review remain outstanding.
- Road routing is required for production dispatch as before; straight-line dispatch fallback policy has not changed.

OpenFreeMap's Liberty style URL is `https://tiles.openfreemap.org/styles/liberty`. OpenFreeMap documents its tiles for MapLibre Native and GL JS and asks clients to follow its download and request limits. OSM attribution must remain visible through the style.
