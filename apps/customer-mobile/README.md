# Smile Customer Mobile

Expo and React Native customer application.

## Setup

1. From the repository root, install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
   - Android emulator: `http://10.0.2.2:4100/api/v1`
   - iOS simulator: `http://localhost:4100/api/v1`
   - Physical device: use your computer's LAN IP and ensure both devices share the network.
3. Start the API, then run `pnpm --filter @makanza/customer-mobile start`.

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

Build profiles live in `eas.json`; `.easignore` excludes local dependencies, Expo cache, and private env files. Configure the API URL in the EAS build environment for each profile.
