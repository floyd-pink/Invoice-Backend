# Invoice Backend

NestJS and TypeScript API for an owner to manage a business, its customers, invoices, payments, quick sales, subscriptions, and invoice sales reports. The app stores records in PostgreSQL with TypeORM and uses Upstash Redis for caching.

## Current features

| Area | What is implemented |
| --- | --- |
| Authentication | User registration, login, JWT issuance, and business selection for owners with multiple businesses |
| Businesses | Owner-linked business creation and a free subscription on creation |
| Customers | Customer registration, business-customer association, and listing associated customers |
| Invoices | Invoice and item creation, optional upfront payment, calculated paid/due amounts and status |
| Payments | Recording later invoice payments and recalculating invoice balance and status |
| Quick sales | Creating completed walk-in sales with items, and listing them with an optional date filter |
| Plans | Free, Pro, and Enterprise plans seeded at startup; limits enforced for invoice, customer, and quick-sale creation |
| Sales reports | UTC daily invoice totals and paginated invoices for a selected day |
| API docs | Swagger UI at `/api/docs` |

The `plans` and `business-subscription` controllers are currently empty; plan seeding and subscription logic are used by services. `POST /contact` is a stub that returns a fixed message.

## Stack and project layout

- NestJS 11, TypeScript, TypeORM, PostgreSQL, Upstash Redis, JWT, class-validator, Jest.
- `src/auth/`: users, login, JWTs, and business selection.
- `src/bussiness/`: businesses and ownership. The folder name is spelled `bussiness` in the code.
- `src/customers/` and `src/business-customer/`: customers and their business associations.
- `src/invoice_items/` and `src/payments/`: invoices, line items, balances, and payments.
- `src/quick-sales/`: walk-in sales, stored separately from invoices.
- `src/plans/` and `src/business-subscription/`: seeded plans, features, and subscription records.
- `src/sales-report/`: period aggregates and day invoice listing.
- `src/common/`: guards, decorators, Redis access, and decimal transformation.
- `src/app.module.ts`: application modules, global guards, and PostgreSQL connection.
- `src/main.ts`: validation, Swagger, CORS, and HTTP startup.

## Run locally

Use Node.js 20 or later. Provide a PostgreSQL database and Upstash Redis credentials. Create `.env` in the repository root:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=replace-with-a-secret
REDIS_URL=your-upstash-redis-url
REDIS_TOKEN=your-upstash-redis-token
```

```bash
npm ci
npm run start:dev
```

The server listens at `http://localhost:3001` and Swagger UI is at `http://localhost:3001/api/docs`. Port 3001 is currently hardcoded in `src/main.ts`. The PostgreSQL connection currently enables SSL, UTC sessions, and TypeORM `synchronize: true`; review those settings before a production deployment. The plan seeder runs on module startup.

Other scripts:

```bash
npm run build
npm run start:prod
npm test -- --runInBand
npm run test:e2e
```

## Authentication and access

1. Register with `POST /auth/sign-up` and log in with `POST /auth/login`.
2. Login returns `access_token`, a business list, and `requiresBusinessSelection`.
3. If business selection is required, call `POST /auth/select-business` with `{ "businessId": "<business-uuid>" }` and use its returned token. After creating a new business, select it to obtain a token containing its ID.
4. Send `Authorization: Bearer <access_token>` on protected routes.

`JwtAuthGuard`, `BusinessContextGuard`, and `RolesGuard` are registered globally. Sign-up and login are public. Business creation and business selection skip the business-context check. For other business routes, the business-context guard verifies that the business ID in the JWT belongs to the user, then `@BusinessId()` provides that ID to the controller. Clients do not supply a business ID to the sales report API.

The global `ValidationPipe` transforms query values and rejects unknown DTO fields. A valid JWT without a selected business does not grant access to business-scoped routes.

## API routes

All paths are relative to `http://localhost:3001`. POST routes accept JSON bodies unless stated otherwise. See `/api/docs` for the annotated DTO fields.

| Method | Path | Purpose / key input |
| --- | --- | --- |
| POST | `/auth/sign-up` | `name`, `phone`, `email`, `password` |
| POST | `/auth/login` | `email`, `password`; returns JWT |
| POST | `/auth/select-business` | `businessId`; returns a JWT for that business |
| POST | `/business/create-business` | `name`, nine-character `panNumber` |
| POST | `/customers/register` | `customer_name`, `customer_phone`, `customer_email` |
| GET | `/business-customer/customers` | Customers linked to the selected business |
| POST | `/invoice-items/create-invoice` | Customer ID, items, optional upfront payment |
| POST | `/payments/invoice/:invoiceId/receive-payment` | Payment against an invoice UUID |
| POST | `/quick-sales/create-quick-sale` | Walk-in sale and items |
| GET | `/quick-sales/my-quick-sales` | Quick sales for the selected business; optional `date=YYYY-MM-DD` |
| GET | `/sales-report` | Period and daily invoice totals |
| GET | `/sales-report/invoices` | Paginated invoices for one UTC day |
| POST | `/contact` | Placeholder response; no contact submission is stored |

### Customer and invoice workflow

Create a business, select it, register a customer, and use that customer's UUID when creating an invoice. The invoice service checks that the customer is linked to the selected business, checks the subscription's invoice limit, calculates each item total, and saves the invoice, items, and any upfront payment in one transaction.

Example invoice body:

```json
{
  "customer_id": "<customer-uuid>",
  "payment_method": "CASH",
  "paid_amount": 50,
  "items": [
    { "item_name": "Design work", "item_price": 100, "item_quantity": 2 }
  ]
}
```

`paid_amount`, `payment_reference`, and `notes` are optional. The invoice's total is the sum of item price times quantity. Its `paidAmount`, `dueAmount`, and status reflect the recorded payments. The status enum includes `DRAFT`, `SENT`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, and `CANCELLED`; creation currently computes unpaid/partially-paid/paid status from the amounts. The entity generates an invoice number and defaults the invoice and due dates.

To record a later payment, call `POST /payments/invoice/<invoice-uuid>/receive-payment`:

```json
{
  "payment_amount": 25,
  "payment_method": "CASH",
  "payment_reference": "receipt-123"
}
```

The payment service requires an invoice in the selected business, rejects cancelled or fully paid invoices and amounts above the remaining due, then saves the payment and updated invoice in a transaction. Supported payment methods are `CASH`, `CARD`, `ESEWA`, `IMEPAY`, `KHALTI`, and `BANK_TRANSFER`.

### Quick sales

Quick sales are separate from invoices and do not require a customer. Example body for `POST /quick-sales/create-quick-sale`:

```json
{
  "paymentMethod": "CASH",
  "items": [
    { "itemName": "Pen", "unitPrice": 10, "itemQuantity": 2 }
  ]
}
```

The service calculates the total, applies the plan limit, and stores the sale and its items in a transaction. `GET /quick-sales/my-quick-sales` lists sales for the business; its optional `date` filter is implemented separately from the invoice sales report.

### Plans and subscriptions

The startup seeder creates Free, Pro, and Enterprise plans and their feature definitions if missing. Creating a business also creates an active Free subscription. `PlanEnforcementService` checks active subscription features and usage before customer, invoice, or quick-sale creation. Subscription and plan data are cached in Redis. There is currently no public plan-management or subscription-management route.

## Sales report API

Both routes are GET requests with **no body**. Dates are `YYYY-MM-DD` in **UTC**, and reports use the invoice's `createdAt` time. Quick sales, draft invoices, and cancelled invoices are excluded. Every report query also filters by the business ID verified from the JWT.

### Period summary: `GET /sales-report`

```text
GET /sales-report
GET /sales-report?from=2026-11-01&to=2026-11-06
```

Without parameters, the report covers seven UTC calendar dates: today and the previous six. With a custom range, both `from` and `to` are required and inclusive. The range must lie within the rolling three-calendar-month window through today; older or future dates return `400 Bad Request`. For today, the database query stops at the current time.

The response contains `period`, `summary`, and `days`. `days` includes zero-invoice dates so a frontend can draw a complete daily chart:

```json
{
  "period": { "from": "2026-11-05", "to": "2026-11-06", "timeZone": "UTC" },
  "summary": {
    "totalInvoices": 2,
    "totalSales": "150.00",
    "totalPaid": "50.00",
    "totalUnpaid": "100.00",
    "totalOverdue": 0
  },
  "days": [
    { "date": "2026-11-05", "totalInvoices": 2, "totalSales": "150.00", "totalPaid": "50.00", "totalUnpaid": "100.00", "totalOverdue": 0 },
    { "date": "2026-11-06", "totalInvoices": 0, "totalSales": "0.00", "totalPaid": "0.00", "totalUnpaid": "0.00", "totalOverdue": 0 }
  ]
}
```

The database computes daily aggregates; the service adds the period summary from those daily results. Money totals are decimal strings to preserve cents. `totalPaid` and `totalUnpaid` describe the **current** paid and remaining amounts on invoices created in the period. They are neither payments received during that period nor a historical balance snapshot. `totalOverdue` counts invoices currently marked `OVERDUE`.

### Day invoices: `GET /sales-report/invoices`

```text
GET /sales-report/invoices?date=2026-11-06&page=1&limit=20
```

`date` is required and follows the same three-month and future-date rules. `page` defaults to 1; `limit` defaults to 20 and cannot exceed 100. The response contains `date`, `timeZone`, a selected-field `invoices` list, and `pagination` (`page`, `limit`, `total`, `totalPages`). Results are ordered newest first by creation time and then ID.

### UTC storage caveat

The current `createdAt` column is a PostgreSQL timestamp without timezone. New database connections use UTC, and the report interprets stored timestamps as UTC. Existing rows written with a different database timezone need review before historical daily totals can be trusted. The report's UTC calendar day can differ from a user's local calendar day.

## Checks and current limitations

```bash
npm run build
npm test -- --runInBand
npm run test:e2e
```

The focused sales-report suites are in `src/sales-report/`. The repository also contains scaffold tests in other modules that do not yet provide their controllers' or services' dependencies, plus an outdated root-controller expectation; the full Jest suite is not currently green.

There is no public route yet to manage plans or subscriptions, and `POST /contact` remains a stub. TypeORM schema synchronization is enabled at startup. The planning worksheet for the report is [SALES_REPORT_THINKING_EXERCISE.md](SALES_REPORT_THINKING_EXERCISE.md).
