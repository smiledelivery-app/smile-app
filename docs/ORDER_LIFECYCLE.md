# Order tracking and handoff verification

## Customer tracking

`GET /api/v1/orders` is scoped to the authenticated customer and returns the order's vendor, ordered status events, current delivery status, and assigned rider name. The customer web and mobile Orders screens poll this endpoint while open (10 seconds) and render a progress timeline: order received, kitchen confirmed, preparing, ready/finding a rider, rider assigned, on the way, delivered. API errors remain visible alongside the last successfully loaded orders.

## Two separate handoff codes

Both codes are six-digit HMAC-derived proofs using `DELIVERY_OTP_SECRET` and a purpose-specific scope. The server does not persist plaintext codes, and the pickup and customer-delivery codes differ.

1. **Vendor pickup code:** After a rider accepts the delivery, only that assigned rider's delivery endpoint returns the pickup code. The rider shows it to the vendor, who enters it in the vendor app. The API verifies it and atomically changes the delivery and order to picked up; up to five invalid attempts are allowed.
2. **Customer delivery code:** Once a rider is assigned, only the customer order endpoint returns their delivery code. The customer gives it to the assigned rider at the door. The rider enters it and the API verifies it before marking the delivery complete; up to five invalid attempts are allowed.

The rider sees the pickup code and shows it to the vendor; the vendor endpoint accepts the code and is the only side that verifies the pickup handoff. The customer sees the delivery code and shows it to the rider; the assigned rider endpoint verifies the customer handoff. Vendor endpoints never return the customer's code, and customer endpoints never return the vendor pickup code. API access checks ensure the customer owns the order, the vendor owns the order, and the rider is assigned to the delivery.

Set `DELIVERY_OTP_SECRET` to a private, stable random secret of at least 32 characters before vendors can mark orders ready. Keep it stable while deliveries are active; changing it invalidates outstanding handoff codes.

## Cancellation

Customers, vendors, and riders can cancel an active order before delivery is completed. Customers and vendors can cancel before pickup; the assigned rider can cancel an active assigned or picked-up delivery. The app requires a role-specific reason, with an optional free-text explanation for “Another reason”; the reason is saved in the cancellation order event. A cancellation changes the order to `CANCELLED`, closes any active delivery offers, and refunds successful development mock payments.

Daily cancellation counts use the Africa/Lagos calendar day and count cancellation events by the acting account: three for customers and riders, five for vendors. Once the limit is reached, the API blocks new customer orders, vendor intake, or rider availability and offers for the rest of that day. Limits are checked by API routes and are independent of client state.

## Tests and limits

Offline tests cover purpose separation and stable code derivation. API syntax checks pass. Database migration, live customer/vendor/rider API requests, mobile/web builds, and end-to-end OTP entry have not been verified because dependencies and a configured PostgreSQL instance are unavailable.
