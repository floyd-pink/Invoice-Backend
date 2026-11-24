# Business subscription payments

## Checkout contract

1. `POST /business/create-business` creates the owner's first business with Free access. Later businesses return `requiresPayment: true`, `subscription: null`, and a `business_id`. They cannot use business routes until a paid payment succeeds.
2. The frontend generates one UUID `requestId` for the purchase and keeps it through retries and page refreshes. It calls `POST /subscription-payments/checkout` with `requestId`, `businessId`, `planId`, and `paymentProvider`.
3. Show the business name, plan, amount, and provider before redirecting. eSewa uses a browser POST form; Khalti uses a GET redirect. Never send provider secret keys to the browser.
4. On return, or after a lost return, poll `GET /subscription-payments/status/:paymentId`. Only `SUCCEEDED` means paid access was granted. `PENDING`, `INITIATING`, and `NEEDS_REVIEW` mean the customer should wait; do not start another payment automatically. The backend shares one provider lookup across closely spaced status polls.
5. A different request ID for the same business still reuses an open checkout when its plan and provider match. A different plan or provider requires the open payment to reach a final state first.

## Recovery and subscription policy

- The app checks due payment attempts every minute. The claim query uses PostgreSQL row locks so multiple app instances can share the work. Claimed provider lookups run in small groups of four so one slow response does not delay every payment. Deploy at least one always-running instance; a sleeping server cannot run the recovery loop.
- Provider status lookup is the authority for success. Network timeouts and unknown statuses keep the payment unresolved. An eSewa browser return is signature checked before its reference is used.
- eSewa's form is generated locally before the customer submits it. An early `NOT_FOUND` does not end that checkout. The first background check is scheduled after five minutes; a browser return can still verify and activate immediately. `NOT_FOUND` becomes final only after an earlier `PENDING` proved the provider had seen the session and at least five more minutes have passed. Otherwise the attempt stays `NEEDS_REVIEW` and is retried with backoff. An unsubmitted form with no definite provider result remains open for investigation; there is no documented safe expiry to guess from form creation time.
- Khalti's returned `expires_at` is saved. An expired link is not reissued on checkout retry; provider lookup must confirm `Expired` or another final state before the attempt is closed.
- Successful verification and subscription activation commit in one database transaction. Repeated callbacks and recovery checks cannot grant the same payment twice.
- One successful payment grants one billing cycle. A same-plan renewal extends the existing end date. A different plan starts a new cycle immediately; unused time on the old plan is not prorated.
- A full or partial provider refund voids that payment's grant. If later successful renewals exist, their recorded expiry is preserved so a refund does not erase time paid for by another charge. If no unexpired paid grant remains, the first business returns to Free; an additional business becomes inactive. Show this customer-friendly refund policy in the customer terms before accepting payments.
- A paid period that expires naturally has the same Free or inactive outcome. The worker applies it; feature checks also reject an expired paid subscription immediately.
- The next billing date is informational. Payments are initiated by the owner; this code does not charge automatically on renewal.

## Deployment

- Set `DATABASE_URL`, `PAYMENT_CALLBACK_BASE_URL`, `PAYMENT_WEBSITE_URL`, `ESEWA_SECRET_KEY`, `ESEWA_PRODUCT_CODE`, `ESEWA_FORM_BASE_URL`, `ESEWA_STATUS_BASE_URL`, `KHALTI_SECRET_KEY`, and `KHALTI_BASE_URL` for the intended environment. Use HTTPS callback and website URLs in production.
- The PostgreSQL client uses `sslmode=verify-full` and verifies the server certificate. Use a trusted Neon connection hostname and certificate chain; do not disable verification to work around a connection error.
- Schema synchronization is off unless `TYPEORM_SYNCHRONIZE=true` outside production. Run `npm run migration:payment:run` as one deployment step before starting the new app version; the command requires `DATABASE_URL` in the environment. It applies the original payment migration and the later lookup-safety migration when pending. The original migration expects the existing `users`, `business`, and `business_subscription` tables; this repository does not yet have baseline migrations for those older modules.
- Test the migration on a copy of the database before live deployment. The unique active-subscription and open-checkout indexes will reject existing duplicate rows so they can be investigated, rather than deleted automatically.
- Monitor warnings and errors from `PaymentReconciliationService` and `SubscriptionPaymentsService`. Investigate repeated `NEEDS_REVIEW`, missing provider references, failed lookups, and refund failures by `paymentId` and provider reference. Providers can remain unavailable or return an unresolved result; automatic code cannot invent a final answer.
- Verify a complete live payment, an interrupted browser return, and a refund using production credentials and provider merchant records before accepting customers.
