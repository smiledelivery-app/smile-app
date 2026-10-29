# Makanza

An original neighbourhood food and essentials delivery platform for Nigerian customers and local kitchens.

## Current implementation

The responsive Next.js storefront reads vendor and product data from the Express API. PostgreSQL through Prisma is the source of truth. In explicit development demo mode, tagged seed records are used only while there are no approved, open real kitchens; once real kitchens are available, the API returns only those real records, even when a search has no matches. With demo mode off, demo records are always excluded. A successful empty result remains empty, and API failures remain errors.

The current customer web and mobile slices include catalog browsing, one-vendor-per-bag cart rules, account access, delivery address creation, server-priced order creation, inventory checks, live-polled order progress, and a customer-only delivery handoff code. Vendor applications enter review, and approved vendor users can manage products, advance orders, and see a vendor-only pickup code after rider assignment. Riders must verify that pickup code before collection, then verify the customer's separate code at delivery. There is no real payment provider configured; checkout is deliberately unavailable unless the API is running in explicit non-production demo mode. See [order lifecycle and handoff verification](docs/ORDER_LIFECYCLE.md).

Customer and operations Expo apps use the shared API. The operations app has separate vendor and rider workspaces, rider proximity offers and route maps, vendor pickup-code display, and rider pickup/delivery code verification. Customer web and mobile Orders screens show a live-polled status timeline and customer delivery code. Product operations UI, real payments, push notifications, sockets, password verification/reset, expanded admin controls, and integration/E2E coverage still need work. App builds and database-backed journeys remain unverified because dependencies and PostgreSQL are unavailable. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), [mobile setup](docs/MOBILE_APPS.md), and [order lifecycle](docs/ORDER_LIFECYCLE.md).

## Requirements

- Node.js 20+ and pnpm 9+ (configured as the workspace package manager; enable with `corepack enable`)
- PostgreSQL 15+

## Local setup

1. Copy `.env.example` to `.env`.
2. Set a local PostgreSQL `DATABASE_URL` and `DEMO_PASSWORD` (at least 12 characters, development only).
3. Install dependencies with `pnpm install`.
4. Generate Prisma client and apply the migration: `pnpm db:generate`, then `pnpm db:migrate:dev`.
5. Add demo records: `pnpm db:seed:demo`.
6. Start the API and web app: `pnpm dev`.
7. Open `http://localhost:3000`; API health and database readiness are at `/api/v1/health` and `/api/v1/ready` on port 4100.

Demo sign-in after seeding:

- Customer: `customer.demo@makanza.example`
- Vendors: `vendor1.demo@makanza.example` through `vendor4.demo@makanza.example`
- Password: the local `DEMO_PASSWORD` value

Vendors sign in through the shared operations account form; an account with the `VENDOR` role sees the Kitchen desk. Vendor applications can be submitted on the web landing page. Product create/update/archive routes are implemented but do not yet have a product editor UI.

Demo rider: `rider.demo@makanza.example`, password from `DEMO_PASSWORD`. Rider profiles are approved/online in the demo seed and have one tagged current location; actual device location uses foreground permissions in the operations app.

Demo administrator: `admin.demo@makanza.example`, password from `DEMO_PASSWORD`. The protected admin view currently covers platform counts and vendor/rider application review, with API audit records. It is an initial operations slice, not the full requested administration suite.

## Database and demo data safety

- `pnpm db:migrate:dev` creates/applies versioned development migrations.
- `pnpm db:migrate:deploy` applies migrations in a deployment environment.
- `pnpm db:seed:demo` requires `DEMO_MODE=true`, refuses production, and adds/upserts tagged demo users, vendors, products, and a demo customer address. It never deletes records.
- Keep demo data in a dedicated development database. Do not run the demo seed in production.
- Demo orders and payment records are tagged and use a development-only mock. No money is charged or transferred.
- Demo catalog records are filtered out whenever `NODE_ENV=production` or demo mode is off.

## Commands

- `pnpm dev` — API and web development servers
- `pnpm typecheck` — TypeScript checks
- `pnpm test` — pure order, catalog-isolation, money, and rider proximity tests
- `pnpm build` — API compilation and Next.js production build
- `pnpm db:generate` — generate Prisma client
- `pnpm db:migrate:dev` — create/apply development migration
- `pnpm db:migrate:deploy` — apply existing migrations
- `pnpm db:seed:demo` — additive demo seed
- `pnpm mobile:customer` — start customer Expo app
- `pnpm mobile:ops` — start shared vendor/rider Expo app
- `pnpm mobile:typecheck` — type-check the two mobile apps (after dependency install)

## Configuration

See `.env.example` and the two mobile `.env.example` files. PostgreSQL is required for API catalog and orders. `DEMO_MODE=true` is permitted only outside production and is needed for demo checkout. `PAYMENT_PROVIDER=mock` is not a live gateway; Paystack credentials are not wired into checkout. Rider dispatch applies service-area and straight-line prefiltering, then ranks candidates with Google road distance when `GOOGLE_MAPS_ROUTES_API_KEY` is configured; see [Google Maps rider setup](docs/GOOGLE_MAPS.md). Native rider maps need separate restricted SDK keys and a rebuilt binary. Push offers and socket updates are not connected, so the operations app polls while foregrounded. Set a private `DELIVERY_OTP_SECRET` and keep it stable to preserve active delivery codes. Do not use example secrets in production.

## Known verification limits

The environment rejected npm registry requests with `EACCES`, so packages could not be installed. API source syntax checks and 9 offline API rule/provider-adapter tests pass. Type-check and build remain blocked because `tsc` is unavailable; the app, SQL migrations, database seed, live Google calls, and end-to-end order path have not been runtime-tested in this environment. Git is unavailable here, so no checkpoint commit could be made.
