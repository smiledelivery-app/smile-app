# Standalone admin dashboard

## Architecture

`apps/admin` is an independently deployable Next.js application with separate App Router pages at `/`, `/orders`, `/customers`, `/vendors`, `/riders`, `/transactions`, `/disputes`, `/audit`, and `/access`. It calls the existing Express API using its authenticated session token; it never connects to PostgreSQL. All data reads and mutations are served by `/api/v1/admin/*` and checked against the administrator's database-backed roles in the API. Existing `ADMIN` accounts remain compatible as super-admins. New roles are additive Prisma enum values.

The API is the source of truth. Dashboard queries do not seed, substitute, or silently fall back to demo data. Sensitive review actions carry a reason and write audit records in the same database transaction. Administrative data excludes demo records.

## Existing capabilities reused

- `User`, `Vendor`, `RiderProfile`, `Order`, `Delivery`, `Payment`, `WalletTransaction`, `Session`, and `AuditLog`.
- Existing password hashing, revocable bearer sessions, and authenticated `/auth/login`, `/auth/me`, and `/auth/logout`.
- Existing vendor/rider application review and audit trail.
- Existing road-distance routing integration and fresh rider location records.

## Implementation status

| Area | Status |
| --- | --- |
| Independent admin app with separate dashboard, orders, customers, vendors, riders, transactions, audit, and access pages; login and role-gated navigation | Implemented in this milestone |
| API role enforcement, overview, order/customer/vendor/rider/transaction lists and filters | Implemented in this milestone |
| Vendor/rider approve, reject, suspend with required reason and audit trail | Implemented in this milestone |
| Audit log browsing, administrator creation/role changes, session history and revocation | Implemented in this milestone |
| Dispute records, assignment to self, status/resolution updates, and transactional audit logging | Implemented; apply the support-ticket migration before using the endpoints |
| Live order actions, customer suspension/notes, MFA and email-based password-reset delivery | Not implemented |
| Immutable platform/vendor/rider settlement ledger and refund execution | Not implemented; existing wallet ledger is per-user and is not a platform settlement ledger |
| Versioned distance payout, customer fee, service fee, and commission rules | Not implemented; the existing schema has no such rule models or historical snapshots |
| Promotions, service-area polygons/hours, payment settings, exports, rider map | Not implemented; these entities/integrations are absent |

Those features require domain models, provider/workflow decisions, and migrations; they must not be presented as working controls before the backend persists and enforces them.

## Financial metric definitions

- GMV is the product subtotal on delivered, non-demo orders for the selected period.
- Delivery fee revenue is the recorded customer delivery fee on those orders; it is not rider earnings.
- Collected payments are successful, non-demo payment records; they are not platform revenue.
- Platform revenue and rider earnings are omitted because no platform-fee or rider-earning ledger exists in the current schema.
- Average order value is delivered-order GMV divided by delivered-order count. Completion rate is delivered orders divided by delivered, cancelled, and rejected orders in the selected period.

## Deployment

Deploy `apps/admin` separately from the customer web app. Configure `NEXT_PUBLIC_API_URL` to the HTTPS API base URL (ending in `/api/v1`) and `ADMIN_ORIGIN` on the API to the admin origin. Apply Prisma migrations before deploying the API. Admin login uses the existing API session endpoints; store the bearer token only for the browser tab session and always use HTTPS.
