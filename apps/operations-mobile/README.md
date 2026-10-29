# Smile Operations Mobile

Expo and React Native application for approved vendors and riders. The signed-in user's authorized role determines the operations workflow.

## Setup

1. From the repository root, install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
   - Android emulator: `http://10.0.2.2:4100/api/v1`
   - iOS simulator: `http://localhost:4100/api/v1`
   - Physical device: use your computer's LAN IP and ensure both devices share the network.
3. Start the API, then run `pnpm --filter @makanza/operations-mobile start`.

## Source layout

- `src/onboarding/`: first-run introduction
- `src/auth/`: sign-in
- `src/navigation/`: role selection, vendor and rider workflows
- `src/vendor/`: vendor order components
- `src/rider/`: rider offer components
- `src/services/`: API service entry points
- `src/config/`: public Expo environment configuration
- `src/utils/`: formatting helpers
- `src/theme/`, `src/components/`: visual tokens and shared controls

## Role-specific navigation

The operations app has separate workspaces selected from the roles authorized on the signed-in account:

- Vendors: **Overview**, **Orders**, **Products**, and **Account**. Orders, product listing, product creation, product availability, and vendor profile details use the vendor API.
- Riders: **Go**, **Offers**, **Deliveries**, and **Profile**. Availability, offers, pickup, completion-code confirmation, profile, and foreground location use the rider API.

An account authorized for both roles can switch workspaces from the role switcher. Each workspace has its own bottom tabs and workflow. The server still authorizes every operation.

Location access is requested for the rider workflow and used while online or completing a delivery. `.env.example` is a safe template; never commit `.env` or put private credentials in `EXPO_PUBLIC_*` variables.

Rider deliveries show a Google Maps route when a server Routes API key and native Maps SDK key are configured. Route distance, ETA, and the route line come from the authenticated rider route API. See [Google Maps setup](../../docs/GOOGLE_MAPS.md) for API enablement, restricted keys, Google billing, and the EAS rebuild requirement.

## EAS

Build profiles live in `eas.json`; `.easignore` excludes local dependencies, Expo cache, and private env files. Configure the API URL in the EAS build environment for each profile.
