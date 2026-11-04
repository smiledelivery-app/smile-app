# Backend contract audit and gap report

Audit date: 2026-10-29. The customer mobile mock data is the primary contract source; the API wrapper expects every successful response to contain a `data` property and every error to contain `error.code` and `error.message`.

## Data-consuming screens and contracts

| Consumer | Endpoint and method | Contract used |
| --- | --- | --- |
| Customer home/search/menu | `GET /vendors`, `GET /vendors/:id/products` | `Vendor[]`, `Product[]`, including add-ons and integer `priceMinor` |
| Customer auth/profile/security | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/profile`, `POST /auth/password`, `POST /auth/logout`, `DELETE /auth/account` | `Session`, account profile |
| Customer address picker | `GET/POST/PATCH/DELETE /addresses` | saved label, address, city, coordinates |
| Customer bag/orders | `POST /orders`, `GET /orders` | idempotent server-priced order, `CustomerOrder[]` status timeline |
| Customer wallet activity | `GET /wallet/transactions` | existing payment-history shape, retained for UI compatibility |
| Vendor workspace | `GET/PUT /vendor/profile`, `GET/POST/PATCH/DELETE /vendor/products`, add-on routes | vendor profile, products and add-ons |
| Vendor order desk | `GET /vendor/orders`, `POST /vendor/orders/:id/status` | `VendorOrder[]`, vendor-only pickup proof |
| Rider workspace | rider onboarding/profile/availability/location/offers/delivery/pickup/complete/route routes | rider profile, offers, assignment-scoped delivery and route data |
| Web storefront/admin | same customer/vendor routes plus `/admin/overview`, `/admin/applications`, review-status and audit-log routes | dashboard and review data |

## Before this change

The API already covered the mobile/web ordering contract, product operations, order-state authorization, inventory race protection, rider matching, route access, OTP handoffs, and basic admin review. It used PostgreSQL through Prisma. The following spec gaps remained: Paystack initialization/verification/webhook handling; wallet ledger and atomically safe checkout; Titan DVA persistence/provisioning; direct-pay order confirmation; and an API-level DVA retry path.

## Implemented in this change

- Added Prisma `Wallet`, `WalletTransaction`, and idempotent `PaystackWebhookEvent` records, plus a versioned migration.
- Registration now creates a wallet. DVA assignment runs asynchronously once a non-demo account has email, phone, and Paystack configuration; customer, vendor, and rider roles share one wallet and one dedicated account per user. Live keys request Paystack-Titan; test keys use Paystack's test provider. A profile read or `POST /wallet/dva/retry` can retry provisioning.
- Added `GET /wallet`, `POST /wallet/topup/initialize`, `POST /wallet/dva/retry`, and `POST /orders/:id/pay`.
- Added Paystack transaction initialization, server verification by reference, HMAC SHA-512 signature validation, and duplicate-webhook protection at both `/webhooks/paystack` and `/api/v1/webhooks/paystack`.
- Real orders remain `PENDING_PAYMENT` until a wallet debit or verified `charge.success`; explicit non-production demo checkout continues unchanged.

## Remaining gaps and deliberate assumptions

- Existing customer UI currently exposes payment activity rather than the new wallet balance/DVA contract, so `/wallet/transactions` retains its frontend-required payment-history response. A later UI integration should consume `GET /wallet` and the ledger.
- The apps use foreground polling, not Socket.IO/SSE or push, so realtime remains polling until the mobile clients are equipped for a persistent transport.
- Paystack payout recipients/transfers, split settlement, refunds, email/phone verification, password-reset delivery, OpenAPI generation, and database-backed integration tests remain future work.
- Titan DVA availability and required KYC fields are Paystack-account dependent. The API preserves a `PENDING`/`FAILED` state and does not block signup; use a Paystack test account with DVA enabled to validate the flow before production.
