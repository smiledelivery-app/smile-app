# Role and Mission

You are a senior backend engineer working in this repository. First, **explore the whole repo** (customer, rider and vendor web and mobile apps, plus any existing API or mock data). Read the folder structure, routes, screens, types, mock data, state management and API-call sites before writing any code.

Your job is to build the backend APIs so that they **exactly match what the web and mobile apps already expect and display**. The customer, rider and vendor apps must work in sync as one system. Part of your work is the payment gateway using Paystack.

Treat the **customer mock-up data as the primary source of truth** for field names, response shapes, order statuses, pricing breakdowns and flows. Where the frontends and this spec disagree, the frontend wins. Flag the discrepancy in your summary rather than silently changing the frontend.

## Step 0: Audit before coding

1. List every screen and component in all apps that consumes data (customer, rider, vendor).
2. Extract every mock object, TypeScript interface and API call into an inventory: endpoint, method, request shape, response shape, which app uses it.
3. Produce a short gap report: what the apps need vs. what exists in the backend.
4. Only then design the schema and endpoints. Reuse the existing stack, conventions, linting and folder structure. Do not introduce a new framework unless the repo has no backend.

## Core Principles

- **Contract-first:** response JSON must match the frontend types exactly (casing, nesting, enums, date formats). If the apps use mock data, replace it with real API calls only where needed and keep the shapes identical.
- **Riders and vendors have entirely separate schemas.** They share only a common `User` auth identity (and the shared wallet infrastructure, linked by `userId`). Never merge rider and vendor profiles into one table or model.
- **Real-time sync:** an order status change must be reflected in the customer, vendor and rider apps. Use WebSockets/Socket.IO or SSE, plus REST fallbacks, and push notifications if the apps already support them.
- **Security:** hashed passwords (bcrypt/argon2), JWT access and refresh tokens, role-based access control (`customer | vendor | rider | admin`), input validation, rate limiting, and no secrets in code (use env vars).
- **Database:** do not assume MongoDB. Detect the database, ORM and migration tool already used in the repo (e.g. PostgreSQL with Prisma/Drizzle/TypeORM, MySQL, etc.) and use them. Write migrations, not ad-hoc schema changes. If the repo has no backend yet, default to PostgreSQL with PostGIS. Wherever this document says "model", read it as a table/entity in whatever database the repo uses.
- **Money:** store all amounts as integers in the smallest unit (kobo) and use NGN, unless the apps indicate otherwise.

## Data Model

### Shared `User` (auth identity)

`id`, `firstName`, `lastName`, `email` (verified flag), `phone` (verified via SMS/OTP), `passwordHash`, `profilePicture`, `role`, `createdAt`, `updatedAt`.

Implement email verification and phone OTP flows.

### Rider (courier) profile: separate model/table

- **Account and verification:** national ID / passport number (NIN in Nigeria), date of birth (enforce minimum age), background check status (`pending | approved | rejected`).
- **Vehicle:** type (`bicycle | scooter | motorcycle | car`), license plate (not required for bicycles), driver's license number and expiry, vehicle insurance policy number.
- **Payout and operations:** bank account details (account number, bank code, account name, Paystack `recipient_code`), availability status (`online | offline | on_job`), live coordinates (`lat`, `lng`, `updatedAt`, stored in a geospatial-indexed column, e.g. PostGIS `geography(Point,4326)` with a GIST index), rating average and count.
- **Metrics:** acceptance rate, completion rate, total deliveries.

### Vendor (store/restaurant) profile: separate model/table

- **Business:** store name, business registration number / tax ID, category (`restaurant | grocery | pharmacy | florist | ...`, match the apps), logo and cover banner (cloud storage URLs).
- **Location and operations:** physical address (street, city, state, zip), store coordinates (geospatial-indexed point, e.g. PostGIS `geography(Point,4326)` with a GIST index), delivery radius (km), operating hours per weekday (open/close, closed flag).
- **Financials and settings:** business bank account, Paystack subaccount code, commission rate (percentage), average preparation time (minutes), status (`open | closed | busy | suspended`).
- **Compliance documents:** business license, health/food permits.
- **Catalog:** menu categories and items (match the mock data exactly, including options, add-ons and availability).
- **Metrics:** order fulfillment rate, actual average prep time, rating.

### Customer, Order, Payment, Delivery, Wallet

Derive customer-facing models entirely from the customer mock-up data: addresses, cart, order items, fees (subtotal, delivery fee, service fee, tax, discount, total), order status timeline, ratings and reviews.

Model `Order`, `OrderItem`, `Delivery` (rider assignment, pickup and dropoff coordinates, ETA, status), `Payment`, `Payout`, `Rating`, `Notification`, `Wallet`, `WalletTransaction`.

## Order Lifecycle (keep in sync across all three apps)

Use the exact statuses the apps use. A typical flow is:

`pending_payment → paid → vendor_accepted → preparing → ready_for_pickup → rider_assigned → picked_up → on_the_way → delivered`

with `cancelled`, `rejected` and `failed` branches.

`pending_payment → paid` can be triggered by either a wallet debit or a verified Paystack charge. Every transition must be validated (who may trigger it), logged with a timestamp, and broadcast in real time to the customer, vendor and assigned rider.

## Map, Proximity and Rider Allocation (key feature)

1. **Geo queries:** use the geospatial support of the repo's database (e.g. PostGIS `ST_DWithin` / `ST_Distance` with a GIST index) for vendor discovery (vendors within the customer's radius and open) and rider discovery.
2. **Live tracking:** riders push location updates (throttled, e.g. every 5-10s while online or on a job). Store the latest position and broadcast it to the customer's tracking screen during an active delivery.
3. **Dispatch algorithm:** when an order becomes `ready_for_pickup` (or when the vendor starts preparing, to pre-allocate using prep time):
   - Find riders who are `online`, approved, not on a job and within N km of the **vendor's store coordinates**, with a vehicle type suitable for the order.
   - Rank by distance/ETA to the pickup point, then rating and acceptance rate.
   - Offer the job to the best rider with an expiry (e.g. 30-60s). If declined or timed out, offer it to the next rider, expanding the radius progressively. Handle the case where no rider is found (retry, notify the vendor and customer, escalate to admin).
   - Prevent double assignment with an atomic lock or transaction.
4. **Distance and ETA:** use the same map provider the apps use (check the repo: Google Maps, Mapbox, etc.). Fall back to Haversine if the provider is unavailable.
5. **Delivery radius enforcement:** reject orders where the customer's address is outside the vendor's delivery radius.
6. Expose the endpoints the map screens need (nearby vendors, rider location stream, ETA, route polyline) in the shapes the apps expect.

## Paystack Payment Integration

- **Initialize transaction:** the backend creates a Paystack transaction for the customer's order (amount in kobo, email, unique reference, metadata with `orderId`) and returns `authorization_url` / `access_code` / `reference` as the apps expect.
- **Verify and webhooks:** implement `POST /webhooks/paystack` with **HMAC SHA512 signature verification** (`x-paystack-signature`) and idempotent handling (ignore duplicates). Handle:
  - `charge.success`, `charge.failed`
  - `transfer.success`, `transfer.failed`, `transfer.reversed`
  - refund events
  - `dedicatedaccount.assign.success`, `dedicatedaccount.assign.failed`

  Never trust the client-side callback alone; always verify server-side by reference.
- **Split payments:** use vendor Paystack subaccounts or compute the split manually. The platform keeps the commission (vendor's commission rate), the vendor receives the remainder, and the rider receives the delivery fee (less any platform cut). Make the split logic configurable and fully documented.
- **Payouts:** use Paystack Transfer Recipients and Transfers for vendor and rider payouts (weekly or on-demand, as the apps indicate). Validate bank accounts via Paystack's account-resolve endpoint and store the `recipient_code`. Keep a payout ledger.
- **Refunds and cancellations:** implement refund flows tied to order status.
- **Safety:** persist every payment attempt, never log card data, use idempotency keys, and keep the Paystack secret key in env vars (test and live keys separated).
- **Nigeria note:** use the Paystack **bank code** plus account number instead of a routing number.

## Paystack Dedicated Virtual Account (Titan) and Wallet

Every user gets a personal Paystack Dedicated Virtual Account (DVA) from **Titan (`preferred_bank: "titan-paystack"`)** when they create an account. It can be used to top up an in-app wallet. Customers can also skip the wallet and pay for an order directly.

### Provisioning

- After registration (and once the email and phone Paystack needs are available), create or reuse the Paystack customer (`POST /customer`), then request a dedicated account (`POST /dedicated_account`, or `POST /dedicated_account/assign` with first name, last name, email, phone, `preferred_bank: "titan-paystack"`, `country: "NG"`). Check Paystack's current docs for exact parameters and extra requirements, since these can differ between test and live mode.
- Assignment can be asynchronous. Do not block signup on it. Run it as a background job with retries and set `dvaStatus` to `pending | active | failed`. Expose a retry endpoint for failed cases.
- Store on the user's wallet record: `paystackCustomerCode`, DVA account number, account name, bank name/slug, `dvaId`, `dvaStatus`. Expose these read-only to the apps.
- Apply this to all roles (customer, rider, vendor). The wallet is shared infrastructure linked by `userId`, while each role keeps its own separate profile schema and payout logic.

### Wallet

- `Wallet` per user: balance in kobo (integer), currency NGN, status. Balance is derived from or reconciled against an append-only `WalletTransaction` ledger (`type: topup | order_payment | refund | earning | payout | adjustment`, `direction: credit | debit`, `amount`, `balanceAfter`, `reference`, `orderId?`, `metadata`).
- **Top-up via transfer to the DVA:** when a transfer lands, Paystack sends `charge.success` (channel `dedicated_nuban`). Verify the signature, match the account number or customer code to the user, and credit the wallet. Make crediting **idempotent on the Paystack reference** so a repeated webhook never double-credits. Notify the user in real time.
- **Top-up via card or other channels:** support initializing a normal Paystack transaction flagged as a wallet top-up (`metadata.purpose = "wallet_topup"`) and credit on verified `charge.success`.
- All wallet debits and credits run inside a DB transaction with a balance check, so the balance can never go negative or be double-spent.

### Checkout: two ways to pay (match the apps' checkout UI)

1. **Pay from wallet:** atomically debit the wallet, mark the order `paid`, and write the ledger entry. If the balance is insufficient, return a clear error with the shortfall.
2. **Pay directly without topping up:** initialize a Paystack transaction for the order (card, bank transfer or USSD). Don't touch the wallet. Mark the order `paid` on verified `charge.success`.
3. If the apps show a partial option (wallet plus Paystack for the remainder), support it. Otherwise don't build it, and flag it in the summary.

### Money flow rules

- Wallet-paid orders use the same split logic as Paystack-paid ones. The platform keeps its commission, and vendor and rider shares are credited to their wallets or payout ledgers. Wallet payments don't go through Paystack subaccounts, so settlement happens through the internal ledger and Paystack Transfers.
- Refunds for wallet-paid orders go back to the wallet. Refunds for directly paid orders go back via the Paystack refund API.
- Vendors and riders can withdraw wallet earnings to their verified bank accounts through Paystack Transfers.
- Reconcile periodically: Paystack transactions and DVA credits against the internal ledger, with a job that flags mismatches.

### Wallet endpoints

- `GET /wallet` (balance, DVA details, status)
- `GET /wallet/transactions` (paginated)
- `POST /wallet/topup/initialize`
- `POST /wallet/dva/retry`
- `POST /orders/:id/pay` with `{ method: "wallet" | "paystack" }`
- Real-time event `wallet.updated` so balances refresh instantly in the apps.

### Account-level caveat

DVAs usually need to be enabled on the Paystack business account, and live-mode availability can depend on Paystack's approval. Build against test mode first and flag any account-level blockers in your summary.

## API Deliverables

- **Auth:** register, login, refresh, logout, verify email, phone OTP send and verify, forgot and reset password. Role-specific onboarding for riders and vendors.
- **Vendor:** profile CRUD, hours, status toggle, menu management, incoming orders, accept/reject, mark ready, earnings and payouts.
- **Rider:** profile CRUD, document upload, availability toggle, location updates, job offers (accept/decline), pickup and dropoff confirmation (with proof if the apps have it), earnings, payout history.
- **Customer:** browse and search vendors, menu, cart, checkout, order tracking, order history, ratings, addresses.
- **Admin (minimal):** approve riders and vendors, background check status, suspend accounts.
- **Real-time channels** for order status, rider location, job offers and wallet updates.
- Consistent error format, pagination, and an OpenAPI/Swagger doc generated for every endpoint.

## Quality Bar

- **Seed script** producing data that mirrors the customer mock data, including wallets with balances and a few mock ledger entries, so the apps run against the API with no frontend changes.
- **Unit tests** for:
  - dispatch algorithm
  - order state machine
  - fee/split calculations
  - Paystack webhook signature verification
  - idempotent webhook crediting (same reference sent twice credits once)
  - concurrent wallet debits (no overspend)
  - DVA assignment failure and retry
  - wallet pay vs. direct pay checkout paths
- **Integration tests** for the main order flow.
- `.env.example` listing every variable (DB, JWT, Paystack keys, map API key, storage, SMS provider).
- Small, logical commits and a `README` section describing setup, architecture and how the three apps sync.

## Working Method

1. Audit and write the gap report.
2. Propose the schema and endpoint list, then proceed without waiting unless something is truly ambiguous. Note your assumptions.
3. Implement in this order: auth and users, vendor and menu, customer order flow, base Paystack integration, **wallet and DVA**, dispatch and maps, real-time, payouts, tests.
4. Wire the apps to the live API only where mock data is currently used, keeping the UI untouched.
5. End with a summary: what was built, assumptions made, discrepancies between frontend and spec, account-level blockers (such as DVA enablement), and what's left.