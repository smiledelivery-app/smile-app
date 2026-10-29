# Order tracking and handoff verification

## Customer tracking

`GET /api/v1/orders` is scoped to the authenticated customer and returns the order's vendor, ordered status events, current delivery status, and assigned rider name. The customer web and mobile Orders screens poll this endpoint while open (10 seconds) and render a progress timeline: order received, kitchen confirmed, preparing, ready/finding a rider, rider assigned, on the way, delivered. API errors remain visible alongside the last successfully loaded orders.

## Two separate handoff codes

Both codes are six-digit HMAC-derived proofs using `DELIVERY_OTP_SECRET` and a purpose-specific scope. The server does not persist plaintext codes, and the pickup and customer-delivery codes differ.

1. **Vendor pickup code:** After a rider accepts the delivery, only the owning vendor's order endpoint returns the pickup code. The vendor shares it with that assigned rider when handing over the parcel. The rider enters it in their operations app. The API verifies it and atomically changes the delivery and order to picked up; up to five invalid attempts are allowed.
2. **Customer delivery code:** Once a rider is assigned, only the customer order endpoint returns their delivery code. The customer gives it to the assigned rider at the door. The rider enters it and the API verifies it before marking the delivery complete; up to five invalid attempts are allowed.

Neither code is sent to the rider in order or route responses. Vendor endpoints never return the customer's code, and customer endpoints never return the vendor pickup code. API access checks ensure the customer owns the order, the vendor owns the order, and the rider is assigned to the delivery.

Set `DELIVERY_OTP_SECRET` to a private, stable random secret of at least 32 characters before vendors can mark orders ready. Keep it stable while deliveries are active; changing it invalidates outstanding handoff codes.

## Tests and limits

Offline tests cover purpose separation and stable code derivation. API syntax checks pass. Database migration, live customer/vendor/rider API requests, mobile/web builds, and end-to-end OTP entry have not been verified because dependencies and a configured PostgreSQL instance are unavailable.
