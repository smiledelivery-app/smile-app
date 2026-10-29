# Makanza project instructions

## Architecture
- TypeScript-first workspace: Next.js App Router web, Express API, PostgreSQL/Prisma data layer, shared contracts.
- Keep authorization and business rules on the server. A UI control is never an authorization check.
- Use API results as the source of truth. Never replace a successful empty response with fixtures or hide an API error as an empty state.
- Demo records are explicitly tagged, created by a deliberate seed command, and must never be seeded into production.
- Store monetary amounts as integer minor units. Store timestamps in UTC.

## Commands and status
- Root commands: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm db:generate`, `pnpm db:seed:demo`, `pnpm mobile:customer`, `pnpm mobile:ops`.
- Current status: customer web/mobile ordering and live-polled order progress, vendor order/product operations, road-distance rider dispatch and native route map, initial admin review panel, and separate vendor-pickup/customer-delivery OTP proofs are implemented as first vertical slices. API unit tests pass; database integration, live provider calls, TS typechecks, and native builds remain unverified because dependencies/credentials are unavailable. See `docs/IMPLEMENTATION_PLAN.md`, `docs/MOBILE_APPS.md`, `docs/GOOGLE_MAPS.md`, and `docs/ORDER_LIFECYCLE.md`.
- Git is not currently available in the environment.

## Conventions
- Validate input at API boundaries; return useful loading, empty, and error states.
- Keep external payment, notification, maps, and media providers behind adapters.
- Never use production credentials or execute real charges in development.
- The current checkout API accepts orders only in explicit non-production `DEMO_MODE`; it creates a tagged development mock payment and cannot charge money.
