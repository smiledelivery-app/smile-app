# Smile Customer Mobile

Expo and React Native customer application.

## Setup

1. From the repository root, install dependencies with `pnpm install`.
2. In development, the app defaults to the local API URL for Android emulators (`http://10.0.2.2:4100/api/v1`) and iOS simulators/web (`http://localhost:4100/api/v1`). To override it, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
   - Android emulator: `http://10.0.2.2:4100/api/v1`
   - iOS simulator: `http://localhost:4100/api/v1`
   - Physical device: use your computer's LAN IP and ensure both devices share the network.
   - To display the native rider-tracking map, configure restricted `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` values and set `EXPO_PUBLIC_GOOGLE_MAPS_ENABLED=true`, then rebuild the native app. See [Google Maps setup](../../docs/GOOGLE_MAPS.md).
3. Start the API, then run `pnpm --filter @makanza/customer-mobile start`.

The customer app loads catalog, menus, orders, wallet details, and payment activity from the API. It requires sign-in; API errors and empty responses are shown rather than replaced with local fixtures. API-backed orders require a customer session.

## Source layout

- `src/onboarding/`: first-run introduction
- `src/auth/`: login, signup, and account recovery screens
- `src/tabs/`: home, search, orders, wallet, and profile
- `src/screens/`: vendor menu and cart/order review
- `src/navigation/`: app flow and screen types
- `src/services/`: API service entry points
- `src/config/`: public Expo environment configuration
- `src/utils/`: formatting and small pure helpers
- `src/theme/`, `src/components/`: visual tokens and shared controls

Use `.env.example` as the safe template; never commit `.env` or place private credentials in `EXPO_PUBLIC_*` variables.

## EAS

Build profiles live in `eas.json`; `.easignore` excludes local dependencies, Expo cache, and private env files. Set `EXPO_PUBLIC_API_URL` in the EAS `preview` environment to the isolated staging API before building a preview; never point the demo test account at production.
