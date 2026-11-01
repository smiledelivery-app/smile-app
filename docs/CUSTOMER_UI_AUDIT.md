# Customer app UI/UX audit

## Scope

The customer app is an Expo/React Native TypeScript app with a single stateful
customer navigator, shared `@makanza/mobile-ui` typography, React Native
StyleSheet screens, Ionicons, Expo SecureStore, and API/demo data adapters.

Onboarding is explicitly excluded from redesign: `OnboardingScreen.tsx` and
`theme/onboarding.ts` remain visually and behaviourally unchanged.

## Screen inventory

- Auth: `AuthLayout`, login, signup, forgot password, OTP verification, change password.
- Primary tabs: home, search, orders, wallet, profile.
- Ordering: vendor menu, product/add-on selection, cart, address picker.
- Orders: order detail, native/web tracking map, wallet activity.
- Profile/settings: edit profile, favorites, password, preferences, help, about,
  privacy, delete account.
- Shared components: form field, primary button, tab bar, mobile typography.

## Existing strengths

- Business logic and API contracts are centralized in `CustomerNavigator` and
  the services layer.
- Guest mode and demo checkout are already wired end-to-end.
- Theme persistence, session persistence, live order polling, saved addresses,
  favorites, and platform-specific maps already exist.

## Main UI problems

- Tokens are incomplete; many screens duplicate hex colours, spacing, radii,
  shadows, and typography values.
- Light and dark surfaces do not have a consistent hierarchy, especially in the
  header, tab bar, cards, inputs, and status treatments.
- Core interaction patterns are duplicated instead of shared: buttons, fields,
  notices, cards, empty/error states, and quantity controls.
- Data states often rely on a lone spinner or generic text rather than stable
  skeleton, empty, and retry presentations.
- Several controls are smaller than a comfortable 44pt target and have weak
  pressed/focus states.
- List layouts mix visual density and do not consistently reserve space for
  images, ratings, metadata, or asynchronous content.

## Implementation order

1. Establish semantic light/dark tokens and shared typography/spacing primitives.
2. Add reusable accessible primitives without changing business logic.
3. Restyle shell/navigation and auth handoff.
4. Restyle home/search and vendor/menu ordering surfaces.
5. Restyle cart/checkout, orders/tracking, addresses, wallet, profile/settings.
6. Add consistent loading/empty/error treatments, motion, haptics where safe,
   and run type/build/export verification.
