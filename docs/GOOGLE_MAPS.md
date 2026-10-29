# Rider maps and proximity dispatch

## Flow

- Rider devices send foreground GPS coordinates to `PUT /api/v1/rider/location`; only approved riders can post locations. Locations older than ten minutes are excluded from offers.
- When a vendor marks an order ready, the API finds available riders with a fresh pin, no active delivery, and no pending offer. It filters by service area and maximum straight-line pickup radius, then asks Google Routes API for road distance to the vendor. The three closest reachable riders within `RIDER_MAX_PICKUP_KM` receive expiring offers. Google calls happen outside the database transaction; a serializable transaction and unique rider/delivery constraints guard offer creation and acceptance.
- If routing is not configured, development uses the explicitly non-production straight-line fallback. Production leaves the delivery unassigned unless `GOOGLE_MAPS_ALLOW_STRAIGHT_LINE_FALLBACK=true` is deliberately enabled.
- The assigned rider can request `GET /api/v1/rider/deliveries/:deliveryId/route` for only their own active pickup or drop-off leg. The API returns a driving route polyline and ETA. The operations app renders it with `react-native-maps` and provides Google Maps navigation handoff. Location tracking remains foreground-only.

## Credentials and Google Cloud setup

Enable billing and these APIs in the Google Cloud project: **Routes API** and **Geocoding API**. Set the server-only keys in the root `.env`:

- `GOOGLE_MAPS_ROUTES_API_KEY`: server key for route matrices and rider directions.
- `GOOGLE_MAPS_GEOCODING_API_KEY`: server key used to locate customer/vendor street addresses. It falls back to the Routes key if omitted.
- `GOOGLE_ROUTES_MAX_ORIGINS`: max riders per matrix request, 1–49 (default 25).
- `RIDER_MAX_PICKUP_KM`: maximum route distance for rider pickup (default 12 km).
- `GOOGLE_MAPS_ALLOW_STRAIGHT_LINE_FALLBACK`: default `false`; production-only emergency override.

Restrict server keys to their APIs and server IPs where hosting permits. Do not put these keys in `EXPO_PUBLIC_*` or a web bundle.

For native map tiles, configure separate Google Maps SDK keys in the EAS build environment: `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY`. Restrict Android keys to package `ng.makanza.operations` and the production signing certificate SHA fingerprint; restrict iOS keys to bundle ID `ng.makanza.operations`. Set `EXPO_PUBLIC_GOOGLE_MAPS_ENABLED=true` and rebuild the native binary. Maps SDK keys are included in the app binary, so application restrictions are required. Keep the keys out of source control and the `.env` upload (`.easignore` excludes private environment files).

A browser can supply vendor coordinates through its location permission. Customer addresses and vendors are geocoded server-side when the configured key is available. If a pin remains unavailable, the API keeps the address and the order, but cannot dispatch or draw a route until coordinates can be obtained.

## Geocoded coordinate retention

User-supplied GPS pins are stored without a Google geocode timestamp. Google-geocoded coordinates are marked `geocodedAt`, refreshed when used after expiry, and pruned after 30 days. The original address remains the durable source for re-geocoding. Do not remove the cleanup schedule or use provider-derived coordinates past the allowed retention period.

## Cost and verification

Google bills route-matrix elements; matrix size is bounded to 49 riders per pickup and can be lowered with `GOOGLE_ROUTES_MAX_ORIGINS`. The server uses `TRAFFIC_UNAWARE` road distances to avoid real-time traffic routing costs. Route ranking and client-independent adapter behavior have offline tests. A live Maps call and a signed Android/iOS binary have not been verified until project credentials, billing, EAS environment, and signing are configured.

References: [Compute Route Matrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix), [Routes API usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing), [Geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies), [Expo react-native-maps](https://docs.expo.dev/versions/v55.0.0/sdk/map-view/).
