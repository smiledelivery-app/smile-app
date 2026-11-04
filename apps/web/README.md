# Smile Web

The Next.js customer storefront includes catalog discovery, cart and checkout, order history, vendor onboarding, vendor order management, product catalog management, and a protected admin review panel. Protected actions use the shared API and require a valid signed-in session.

## Local development

1. Install dependencies from the monorepo root with `pnpm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the API origin, for example `http://localhost:4100/api/v1`.
3. Start the API and web app from the repository root with `pnpm --filter @makanza/api dev` and `pnpm --filter @makanza/web dev`.

The public API URL is safe to expose in the browser. Never place private credentials in `NEXT_PUBLIC_*` values. The website reads products and vendors from the API; successful empty results use the empty state, and request failures use the retry/error state.

## Search engines and install metadata

The storefront exposes a web app manifest at `/manifest.webmanifest`, crawler rules at `/robots.txt`, and a sitemap at `/sitemap.xml`. Set `NEXT_PUBLIC_SITE_URL` to the canonical public origin (for example, `https://your-domain.example`) in the production environment before building and deploying; it is used for canonical/social metadata and absolute sitemap URLs. The default is `https://smile.delivery`.

After deployment, verify the site in Google Search Console and submit `https://your-domain.example/sitemap.xml`. Search indexing and ranking are controlled by Google and are not immediate.
