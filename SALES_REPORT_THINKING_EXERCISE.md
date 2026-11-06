# Sales report API: one-hour thinking exercise

Use this worksheet **before writing code**. Write short answers under each prompt. The goal is to make the API's meaning clear enough that you could predict its output for a few example invoices.

## 0-10 minutes: Define the question the report answers

Complete this sentence:

> For the signed-in business owner, this endpoint shows ________ between ________ and ________, and totals ________.

Decide and explain:

- Is this a report of **invoices issued** in the period, **payments received** in the period, or both? These use different dates and may need separate reports.
- Do quick sales belong in this first version? They are stored separately from invoices in this project.
- Is the report for one day or a date range? What is the default when no date is supplied, if dates are optional?
- Which statuses count: `DRAFT`, `SENT`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`? Should excluded invoices still appear in the list?
- Does “sales total” mean the amount billed, the amount paid, or something else? Name each total so a business owner cannot mistake one for another.

**Write your rule in one paragraph:**

> ...what I want here is that when I click on that see invoices I need to see total invoices created(not quick sales here that would be another module) that is total invoices created whenther ammout received or not ,just exclude DRAFT and CANCELLED from selected than between to and from date  and sales total here I want to first show the totalInvoiced made and overall invoices created and also with totalReceivable and totalReceived that is individually for date between selected if choosen from 2nov-5nov for every date I would return daily breakdown but of only 2-5 nov and also total summary ( i am confused if this will make my api slow imagine 10000 users on server and database)


## 10-20 minutes: Design the request and access rules

Sketch one example request, such as `GET /sales-report?from=YYYY-MM-DD&to=YYYY-MM-DD`.

- Which values come from query parameters? Which come from the authenticated request? Should a client be allowed to submit an arbitrary business ID?
- What input format will you accept? Are `from` and `to` required? What happens when one is missing, a date is invalid, or `from` is after `to`?
- What is the largest allowed range? Think about a request for ten years of invoices.
- Which date is filtered: `invoiceDate`, `createdAt`, or payment `receivedAt`? Why?
- For timestamps, which timezone defines the start and end of a business day? Does `YYYY-MM-DD` mean a calendar date or an instant in time?
- What HTTP result should a bad filter get? What should a valid period with no invoices return?

**Security trace:** Draw the path from JWT to `@BusinessId()` to the database query. Point to the exact place where the query limits rows to that business. Consider whether any route or decorator could bypass the existing guards.

**Project clue:** `JwtAuthGuard` and `BusinessContextGuard` are registered globally in `src/app.module.ts`. The business guard calls `BusinessService.isMember()` and sets `request.businessId`; `@BusinessId()` reads it. `isMember()` currently checks ownership. A report query still needs a business ID condition. The guard also caches a successful check for five minutes, which matters if ownership can change.

**Write one valid request and three invalid requests:**

> ...

## 20-30 minutes: Design the response and money rules

Sketch a small JSON response containing the report period, summary totals, and an invoice list. For each field, say why the owner needs it.

- Which invoice fields are necessary? Avoid returning entire database entities by default.
- Will totals cover **all matching invoices** or only the current page of results? State this clearly.
- If an invoice is partly paid, how do `totalAmount`, `paidAmount`, and `dueAmount` contribute to each total?
- If an old invoice receives a payment today, should an invoice-date report for last month change? If you need historical “as of that day” values, are the current invoice fields enough, or must you calculate from payment records?
- What should an empty report contain: zero totals, an empty list, both?
- How will you avoid rounding errors when adding money? The database stores decimal amounts; think about where conversion and rounding happen.

**Write the response for zero invoices and for two invoices:**

> ...

## 30-40 minutes: Make example records and calculate by hand

Use the table below. Add exact dates, amounts, and expected results. Pick a report period that includes some records and excludes others.

| Record | Business | Invoice date | Status | Invoice total | Paid | Due | Included? Why? |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| A | Owner's business | First day of period | Unpaid | 1,000 | 0 | 1,000 | |
| B | Owner's business | Last day of period | Partially paid | 500 | 200 | 300 | |
| C | Owner's business | Outside period | Paid | 300 | 300 | 0 | |
| D | Another business | Inside period | Paid | 900 | 900 | 0 | |
| E | Owner's business | Inside period | Cancelled | 400 | 0 | 400 | |

Calculate your expected invoice count, billed total, paid total, and due total. Then ask:

- What if a payment for B arrives **after** the report period?
- What if `from` and `to` are the same day?
- What if there are no rows?
- What if two invoices have the same date? What secondary sort key gives stable ordering?

Your example is the specification. If you cannot decide whether a row belongs, the API rule needs more work.

## 40-50 minutes: Plan a clean implementation

Write one responsibility for each part:

| Part | What belongs here? | What should stay elsewhere? |
| --- | --- | --- |
| Query DTO | | |
| Controller | | |
| Service | | |
| Database query | | |
| Response shape | | |

Then sketch the flow in plain English, without TypeScript:

1. Receive and validate the date filter.
2. Read the authorized business ID from the request.
3. Query only matching records for that business.
4. Calculate or fetch summary totals using the same inclusion rules.
5. Return a predictable response.

Consider scale without building extra infrastructure yet:

- Could this query load thousands of invoices and their items into memory? Would pagination help the list? How will you return totals for the entire period?
- Are you filtering on an indexed column? The current invoice index covers `(businessId, createdAt)`, while an invoice-date report would filter on `invoiceDate`. What index might be useful after measuring the query?
- Can totals be computed in SQL? If list and summary use separate queries, how will you keep their filters consistent?
- What happens if the data changes between the list query and the totals query? Is a small difference acceptable for this report, or do you need a consistent snapshot?
- Is a report response safe to cache? If so, what changes would invalidate it?

**Write a five-step implementation plan:**

> ...

## 50-60 minutes: Decide how you will prove it works

For each case, write the expected HTTP result and the important fields or totals:

| Case | Expected result |
| --- | --- |
| Valid period with multiple statuses | |
| Same-day period | |
| No matching invoices | |
| Invalid date or reversed range | |
| Missing or invalid JWT | |
| User requesting another business's data | |
| Large result set / next page | |
| Part payment recorded after invoice date | |

Choose the smallest useful test set: one or two service tests for the filtering and totals, one access test if the existing guard tests do not cover the path, and a manual request using real example data. Avoid tests that merely repeat the code's implementation.

## Final design note

When the hour ends, write these five sentences before coding:

1. **Meaning:** This report measures ...
2. **Input:** It accepts ...
3. **Access:** Only ... can view it because ...
4. **Output:** It returns ...; totals cover ...
5. **Proof:** I will know it is correct when ...

Keep the first version narrow. A clear, correct invoice report is a better foundation for later payment and quick-sale reports than one endpoint with unclear totals.

### Files to inspect while answering

- `src/app.module.ts` and `src/common/guards/business-context.guard.ts` — global access checks.
- `src/common/decorators/business-id.decorator.ts` and `src/bussiness/bussiness.service.ts` — business context and ownership.
- `src/invoice_items/entities/invoice.entity.ts` — invoice dates, statuses, amounts, and indexes.
- `src/payments/entities/invoicePayments.entity.ts` — payment date and amount.
- `src/quick-sales/entities/quickSales.entity.ts` — separate quick-sale records.
- `src/sales-report/` — current report controller and service stubs.
