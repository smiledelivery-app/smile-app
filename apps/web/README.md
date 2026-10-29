# Smile Web

The Next.js customer storefront includes catalog discovery, cart and checkout, order history, vendor onboarding, vendor order management, product catalog management, and a protected admin review panel. Protected actions use the shared API and require a valid signed-in session.

## Local development

1. Install dependencies from the monorepo root with `pnpm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the API origin, for example `http://localhost:4100/api/v1`.
3. Start the API and web app from the repository root with `pnpm --filter @makanza/api dev` and `pnpm --filter @makanza/web dev`.

The public API URL is safe to expose in the browser. Never place private credentials in `NEXT_PUBLIC_*` values. The website reads products and vendors from the API; successful empty results use the empty state, and request failures use the retry/error state.
