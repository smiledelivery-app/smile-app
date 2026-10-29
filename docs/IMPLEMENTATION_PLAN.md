# Makanza implementation plan

## Repository assessment

The workspace started empty: no source files, package manifest, framework setup, or Git executable were available. Node.js and npm are installed. No database, mobile tooling, credentials, or running service was supplied.

## Milestones

1. **Foundation:** TypeScript workspace, database schema/migrations, API boundary and reproducible development data (implemented; runtime verification pending).
2. **Customer ordering:** web and Expo client slices for discovery, cart, auth, checkout and order history (demo flow implemented; integration verification pending).
3. **Vendor operations:** onboarding, role/ownership checks, product API, web product catalog editor, mobile product controls, and order desk (implemented as a first slice; runtime verification pending).
4. **Rider delivery:** onboarding, matching, offers, assignment and delivery lifecycle (API and mobile foreground flow implemented, not integration-verified).
5. **Platform services:** payment provider/webhooks, push/socket updates and admin operations (pending).
6. **Readiness:** integration/E2E tests, security/performance review, production builds and deployment configuration (pending).

## Progress on 2026-10-28

### Web vendor catalog continuation

- Added a Products tab to the authenticated vendor web desk, backed by the vendor-owned product API. Vendors can create products with naira pricing and optional stock, inspect the returned catalog, and pause or republish items.
- Preserved server-side authorization and approval requirements; unapproved vendors continue to see their application status rather than product controls.
- Added a web app README and `NEXT_PUBLIC_API_URL` template, and repaired corrupted currency and display symbols in the storefront.
- Web `typecheck` was attempted but remains blocked because dependencies are not installed (`tsc` is unavailable in this environment).

### Foundation and customer/vendor web slice (implemented, not runtime-verified)

- Added TypeScript workspaces for Next.js and Express, shared compiler settings, environment template, setup docs, and this plan.
- Added responsive storefront discovery/search, database-backed vendor menus, a session-persisted single-vendor bag, registration/sign-in, delivery address entry, order placement, customer order history, and a role-gated vendor order desk.
- Added Prisma PostgreSQL schema and versioned SQL migrations for users, sessions, addresses, vendors, products, orders, status history, payments, rider profiles, rider location, offers, deliveries, and administrative audit records.
- Added additive development seed data for tagged kitchens/products, demo users, and an address. Seed requires an explicitly configured demo password and refuses production.
- Demo catalog selection now yields to approved/open real kitchens at the resource level; it never mixes the two sources or fills a real search's empty result with seed cards.
- Added vendor application API and landing-page application form. New vendors enter `PENDING_REVIEW`; product management routes require `APPROVED` status. Vendor-owned product create/update/archive endpoints and a limited order desk are present.
- API enforces password hashing, opaque revocable sessions, role checks, vendor ownership, order state transitions, item/vendor/stock validation, idempotency, serializable inventory updates, and development-only mock payment tagging.
- Real checkout stays disabled until a provider integration is implemented. Demo order creation records no real payment or transfer.
- Rider API applies approval/availability/location freshness, service-area and pickup-radius matching, bounded expiring offers, retry, atomic single-rider assignment, assignment-scoped address disclosure, pickup transition, and HMAC-backed delivery-code verification with attempt limits.
- Added role-protected admin overview, vendor/rider application review, and audit-log endpoints plus an initial web review panel.
- Added Expo customer and vendor/rider apps with a shared API client and SecureStore sessions. Rider location runs in the foreground only and marks a rider offline on background; offer polling is used because push/socket services are not configured.
- Added Node built-in unit tests for vendor order transitions, integer checkout calculations, demo-vs-real catalog precedence, and rider proximity matching. `npm test` passes (5 tests). Node's built-in TypeScript syntax check passed for the API and seed, and workspace JSON manifests parse.
- `npm install` was attempted and failed on registry access (`EACCES`). `typecheck` and `build` were attempted but cannot find `tsc`; the React UI, Prisma schema/migration, seed, and database/end-to-end behavior remain unverified.
- Git is not installed in the shell, so no checkpoint commit is available.

### Next concrete work

1. Install dependencies in an environment with npm registry access and compile/repair all packages.
2. Apply migration and seed against local PostgreSQL; exercise customer order and vendor state transitions.
3. Add automated API integration tests for auth, vendor approval/ownership, idempotency, stock races, and mock payment isolation.
4. Add integration tests for rider acceptance races, rider authorization, OTP, and offer expiry; complete admin management workflows, then real payment, realtime notifications, and deployment preparation.

### Google Maps and rider dispatch progress (2026-10-28)

- Added server Google Routes adapters for bounded road-distance matrices and rider turn-by-turn route geometry; rider endpoint scopes route access to the assigned rider and active delivery leg.
- Rider assignment filters fresh approved/available riders by service area and maximum pickup radius, then ranks up to three reachable riders by route km. A development-only straight-line fallback is isolated; production requires configured routing or an explicit fallback override.
- Vendor onboarding accepts a browser map pin; address creation and vendor onboarding geocode addresses server-side when configured. Google-geocoded coordinate cache is timestamped and pruned after 30 days; user GPS pins are retained as user supplied data.
- Added rider native Google map UI and EAS key configuration; the app displays route, distance/ETA, and navigation handoff when credentials are present.
- Added offline unit coverage for road-distance ordering and Google matrix, route and geocode adapters. `node --experimental-strip-types --test apps/api/test/order-rules.test.mts` passes (9 tests). Live Routes/Geocoding calls, Prisma migration execution, TS typecheck, and native builds remain unverified because credentials/dependencies are unavailable.
- Setup and billing/key restrictions are documented in `docs/GOOGLE_MAPS.md`.

### Order tracking and two-party OTP handoff progress (2026-10-28)

- Customer web and mobile Orders screens now show order stages through vendor confirmation, preparation, rider matching, assignment, pickup/in-transit, and delivery. They refresh while open; customer web and mobile show the delivery code only after rider assignment.
- Vendors see a purpose-specific pickup code only on their own order after rider assignment. Riders must enter that code before pickup; after pickup they enter the separate customer code to complete delivery.
- Pickup attempts are limited to five, verification and order-state changes are transactional, and the two HMAC proofs use separate scopes. Added migration `202610280006_vendor_pickup_otp`.
- Mobile vendor/rider workspaces refresh their respective code/status data while foregrounded. Offline tests now cover separate stable proof codes; API unit suite passes (9 tests).
- Database migration and end-to-end app behavior remain unverified because PostgreSQL and installed build dependencies are unavailable.

## Risks and dependencies

- PostgreSQL, Redis, maps, payments, push credentials, and mobile signing are not configured. External integrations will use isolated development adapters until credentials are supplied.
- Dependency registry access is blocked in this environment. No live app/browser verification has been performed.
- Git is not installed in the current shell, so logical commits cannot be created here.
