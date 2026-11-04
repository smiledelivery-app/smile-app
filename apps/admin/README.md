# Smile Admin Dashboard

Independent Next.js application; the browser talks only to the existing Express API.

## Local development

1. Install workspace packages from the repository root with `pnpm install`.
2. Set `NEXT_PUBLIC_API_URL` to the API URL ending in `/api/v1` (default: `http://localhost:4100/api/v1`).
3. Configure `ADMIN_ORIGIN=http://localhost:3001` in the API environment.
4. Apply migrations and provision the first super-admin. For local development, set `ALLOW_ADMIN_SEED=true`; for production, run `pnpm db:bootstrap:admin` once from a controlled deployment shell with `NODE_ENV=production` and `ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=true`. In either case provide `ADMIN_SEED_EMAIL`, `ADMIN_SEED_NAME`, `ADMIN_SEED_PASSWORD` (12+ characters), and `ADMIN_SEED_CONFIRMATION` (must exactly match the email) through untracked local configuration or an ephemeral deployment secret. The script refuses mismatched environment/commands, does not alter an existing account, refuses to promote a customer account, and writes an initial audit record. Never put the password in tracked files; unset the bootstrap secrets after the one-time run.
5. Run `pnpm --filter @makanza/admin dev`.

The login flow uses the existing `/auth/login`, `/auth/me`, and `/auth/logout` endpoints. A token is held in `sessionStorage` for the current browser tab. Use HTTPS in production; the API enforces every administrative permission regardless of the visible navigation.

## Production sign-in

Deploy this app to the admin hostname and set `NEXT_PUBLIC_API_URL` to the production API URL ending in `/api/v1`; set `ADMIN_ORIGIN` on the API to the exact HTTPS admin origin. After the one-time super-admin bootstrap, use that account's email and password on the deployed `/login` page. Create named administrator accounts with scoped roles from **Access & sessions**; do not share the bootstrap account for routine work.

## Independent deployment

Build with `pnpm --filter @makanza/admin build` and deploy the standalone Next.js output to the admin hostname. Set `NEXT_PUBLIC_API_URL` at build time to the HTTPS API URL and set `ADMIN_ORIGIN` on the API to the exact HTTPS admin origin. Apply database migrations (including `202611040004_support_tickets`) and generate Prisma Client before deploying API changes. Do not put database credentials or provider secrets in this app's environment.
