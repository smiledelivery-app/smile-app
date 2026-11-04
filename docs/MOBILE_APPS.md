# Makanza mobile clients

Two Expo React Native apps use the shared `@makanza/mobile-core` API helper and the same Express API as the web app.

## Apps

The customer app now opens on a photo-led Lagos discovery experience with a delivery-location header, search, quick category filters, editorial food banner, kitchen cards with delivery details, a persistent bag shortcut, and a compact three-destination navigation bar. The operations app has a separate service-desk presentation, with live order counts and a kitchen-first action hierarchy; vendor and rider workflows remain role-gated and use the shared API. Remote food photography is used for catalog presentation, while all listing and menu content still comes from the database API.

- `apps/customer-mobile`: customer registration/sign-in, API-backed kitchen search, menu browsing, a single-kitchen cart, address entry, development-only demo order placement, and order history. Session tokens are held in Expo SecureStore.
- `apps/operations-mobile`: role-first onboarding for vendor and rider accounts, with role-specific sign-in and signup. Auth uses the same `/auth/register`, `/auth/login`, and session endpoints as the customer app; the selected role opens its vendor or rider application. Applications update the shared user record, so customer, vendor, and rider apps use one account. Users with both roles can switch workspaces; server authorization remains authoritative.
- Approved riders can request foreground location permission, send a fresh location before going online, and share updates while the app remains open (about once a minute or after 100 m). Offers refresh while the app is active. Accept/reject, assigned deliveries, pickup confirmation, and six-digit completion verification call the rider API. The customer app displays the delivery code only when the API returns it for an assigned delivery.
- Leaving the app stops location updates and marks an online rider offline. Active delivery controls remain available on return and can resume foreground location explicitly. The app does not request background location or promise tracking while the operating system suspends it.

## Start

From the repository root, install the workspace dependencies first. Copy each app's `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to an address reachable from the test device, for example `http://192.168.1.10:4100/api/v1`. `localhost` on a physical phone points to that phone, not the development computer. Android emulators commonly reach the host through `10.0.2.2`; iOS simulators can usually use `localhost`.

Then run one app at a time:

- `pnpm --filter @makanza/customer-mobile start`
- `pnpm --filter @makanza/operations-mobile start`

Use Expo's Android/iOS launch controls. Root scripts are available as `pnpm mobile:customer` and `pnpm mobile:ops`.

For local API-backed exploration, start PostgreSQL, apply migrations, and seed demo data using the main [README](../README.md). Demo customer and vendor credentials are defined by `DEMO_PASSWORD`.

## Customer phone signup

New customer accounts normally require a phone verification code before the API creates the account or issues a session. Signup can use Infobip 2FA over SMS or an approved Infobip WhatsApp authentication template. For SMS, configure `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_2FA_APPLICATION_ID`, `INFOBIP_2FA_MESSAGE_ID`, and `INFOBIP_2FA_SENDER`; create an enabled 2FA application and SMS message template first. For WhatsApp, configure `INFOBIP_WHATSAPP_SENDER`, `INFOBIP_WHATSAPP_TEMPLATE_NAME`, and optionally `INFOBIP_WHATSAPP_TEMPLATE_LANGUAGE`; register and obtain approval for an authentication template with one body placeholder for the code. The API stores Infobip's `pinId` for SMS and a keyed code digest for WhatsApp, then verifies the submitted code server-side. Twilio Verify code and environment variables are retained but inactive. Signup data expires after 15 minutes and resend requests are limited to one per minute.

For local development only, set `PHONE_VERIFICATION_BYPASS=true` to create a tagged demo customer account and sign in immediately without sending a code. Its phone remains unverified. The API ignores this flag when `NODE_ENV=production`.

See [Twilio Verify phone verification](https://www.twilio.com/docs/verify/api/verification) and [WhatsApp verification setup](https://www.twilio.com/docs/verify/whatsapp). Existing accounts continue to sign in by email and password. Changing a phone number on an existing account requires verification; the current profile endpoint rejects unverified phone changes.

The operations app shares account registration and login with the customer app/web. New vendors and riders can create an account from their selected role flow, then submit the vendor or rider application in the matching workspace. The selected role is stored locally for the next launch, while role membership and approval status come from the API. A customer can sign in with the same account and apply for either role. Operational tools remain gated by server-side approval. The development seed provides a demo rider account.

## SDK and verification

Both apps use Expo SDK 57 with React Native 0.86 and React 19.2. Their native maps use `react-native-maps`, which is included in Expo Go. Native app builds use the `react-native-maps` config plugin for optional Google Maps SDK keys. Start either app with the workspace script from the repository root.

MapLibre was removed from the mobile apps because Expo Go does not include its native module. Device permission prompts, location behavior, rider acceptance races, and delivery OTP flow still require runtime testing against a migrated development database.
