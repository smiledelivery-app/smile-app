# Makanza mobile clients

Two Expo React Native apps use the shared `@makanza/mobile-core` API helper and the same Express API as the web app.

## Apps

The customer app now opens on a photo-led Lagos discovery experience with a delivery-location header, search, quick category filters, editorial food banner, kitchen cards with delivery details, a persistent bag shortcut, and a compact three-destination navigation bar. The operations app has a separate service-desk presentation, with live order counts and a kitchen-first action hierarchy; vendor and rider workflows remain role-gated and use the shared API. Remote food photography is used for catalog presentation, while all listing and menu content still comes from the database API.

- `apps/customer-mobile`: customer registration/sign-in, API-backed kitchen search, menu browsing, a single-kitchen cart, address entry, development-only demo order placement, and order history. Session tokens are held in Expo SecureStore.
- `apps/operations-mobile`: shared sign-in for vendor and rider roles. Vendor users can load their own kitchen orders and submit accept/reject/preparing/ready transitions. Users with both roles can switch the visible workspace. A signed-in customer account may submit rider onboarding; the rider workspace stays limited until the API reports the role/profile state.
- Approved riders can request foreground location permission, send a fresh location before going online, and share updates while the app remains open (about once a minute or after 100 m). Offers refresh while the app is active. Accept/reject, assigned deliveries, pickup confirmation, and six-digit completion verification call the rider API. The customer app displays the delivery code only when the API returns it for an assigned delivery.
- Leaving the app stops location updates and marks an online rider offline. Active delivery controls remain available on return and can resume foreground location explicitly. The app does not request background location or promise tracking while the operating system suspends it.

## Start

From the repository root, install the workspace dependencies first. Copy each app's `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to an address reachable from the test device, for example `http://192.168.1.10:4100/api/v1`. `localhost` on a physical phone points to that phone, not the development computer. Android emulators commonly reach the host through `10.0.2.2`; iOS simulators can usually use `localhost`.

Then run one app at a time:

- `pnpm --filter @makanza/customer-mobile start`
- `pnpm --filter @makanza/operations-mobile start`

Use Expo's Android/iOS launch controls. Root scripts are available as `pnpm mobile:customer` and `pnpm mobile:ops`.

For local API-backed exploration, start PostgreSQL, apply migrations, and seed demo data using the main [README](../README.md). Demo customer and vendor credentials are defined by `DEMO_PASSWORD`.

The operations app shares login with the customer app/web. Create a Makanza account in either customer client first, then sign in to operations. A customer-only account can submit a rider application there; vendor users need an approved vendor account, and rider controls remain locked until the rider application is approved. The development seed provides a demo rider account.

## SDK and verification

Both apps pin Expo SDK 55 with React Native 0.83 / React 19.2 as listed in the [Expo SDK 55 compatibility table](https://docs.expo.dev/versions/v55.0.0/). SecureStore is pinned to Expo's [SDK 55 recommended version](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/); Expo Location uses the [SDK 55 recommended version](https://docs.expo.dev/versions/v55.0.0/sdk/location/). Node 20.19+ is required by that SDK; the available environment uses Node 24.

These source/config files were not installed or built because npm registry access is blocked in this environment. No emulator or device runtime has been verified. Device permission prompts, location behavior, rider acceptance races, and delivery OTP flow still require runtime testing against a migrated development database.
