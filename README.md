# Invoicing & Business Finance Tracker (Backend)

A backend system built with **NestJS** and **TypeScript** for business owners to register their business, manage their customers, and (eventually) track invoices and financial activity — all backed by a cloud PostgreSQL database (**Neon**).

> ⚠️ **Status: Work in Progress.** Auth, business registration, customer registration, and business–customer linking are implemented. Invoicing and financial-activity tracking are actively being built out.

---

## About the Project

This project lets a business owner:

- **Log in / register** as either a **business** or a **customer** (role-based auth via JWT)
- **Register a business** once logged in as a business owner
- **Register customers** under that business
- **Link customers to businesses** through a dedicated join model, so each business keeps its own set of customers
- (In progress) Create invoices and invoice items, and track financial activity per business/customer

The long-term goal is a full invoicing system where every business can independently manage its own customers and financial records.

---

## Tech Stack

- **Language:** TypeScript
- **Framework:** [NestJS](https://nestjs.com/)
- **Database:** PostgreSQL, hosted on [Neon](https://neon.tech/) (serverless/cloud Postgres)
- **ORM:** TypeORM *(update if you're using Prisma instead)*
- **Auth:** JWT-based authentication, with route protection via a custom `JwtAuthGuard`
- **Testing:** Jest (`.spec.ts` files present per module)

---

## Project Structure

```
src/
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── entities/
├── business/
│   ├── dto/
│   ├── entities/
│   ├── bussiness.controller.ts
│   ├── bussiness.service.ts
│   └── bussiness.module.ts
├── business-customer/          # Join module linking a business to its customers
│   ├── dto/
│   ├── entities/
│   ├── business-customer.controller.ts
│   ├── business-customer.service.ts
│   └── business-customer.module.ts
├── customers/ 
├── contact/                    # (in progress)
├── invoice_items/              # (in progress)
├── common/
│   ├── decorators/
│   │   └── active-user.decorator.ts   # Pulls the logged-in user off the request
│   └── guards/
│       └── jwt-auth.guard.ts          # Protects routes, requires valid JWT
├── app.module.ts
└── main.ts
```

---

## How It Works

1. **Auth** — A user logs in either as a **business** or as a **customer**. Successful login issues a JWT, which is required (via `JwtAuthGuard`) to access protected routes. The `@ActiveUser()` decorator pulls the current logged-in user's info out of the request in any controller that needs it.

2. **Business Registration** — Once logged in as a business, the owner can create their business profile (`business` module). This is stored as its own entity in Postgres.

3. **Customer Registration** — The business can then register customers under their business. Registration goes through a DTO that validates the required fields before the record is created.

4. **Business–Customer Linking** — Rather than storing customers as a plain foreign key on the business, a separate **`business-customer`** join model tracks the relationship between a business and its customers in its own table. This keeps the association flexible (e.g. a customer could in theory be linked to multiple businesses) and keeps business and customer data cleanly separated.

5. **Database** — All data is persisted to a **Neon**-hosted Postgres instance, so the database is cloud-based rather than local.

6. **Invoicing (planned)** — `invoice_items` and related financial-activity tracking are the next modules being built, tying invoices back to a specific business and customer.

---

## Features

### ✅ Implemented
- [x] Auth module — login as business or customer, JWT-protected routes
- [x] Business registration
- [x] Customer registration (via DTO validation)
- [x] Business–customer linking (join table/model)
- [x] Custom guard (`JwtAuthGuard`) and decorator (`@ActiveUser`) for auth

### 🚧 In Progress / Planned
- [ ] Invoice creation (`invoice_items` module)
- [ ] Financial transaction / payment recording
- [ ] Contact module (`contact`)
- [ ] Business-level financial summary (balances, totals owed, etc.)
- [ ] Full test coverage (spec files scaffolded, not all filled in)
- [ ] API documentation (Swagger)

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- A Neon (or any PostgreSQL) database connection string

### Installation

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3001
DATABASE_URL=your_neon_postgres_connection_string
JWT_SECRET=your_jwt_secret
```

### Running the App

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server runs at `http://localhost:3001`

---

## API Overview

| Method | Endpoint                     | Description                                        | Status      |
|--------|-------------------------------|------------------------------------------------------|-------------|
| POST   | `/auth/login`                  | Log in as business or customer, returns JWT           
| POST   | `/auth/sign-up`               | Register a new business or customer account              
| POST   | `/create-business`                     | Register a new business (owner must be logged in)  
| POST   | `/business/:businessId/register`                     | Register a new customer under a business              




```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

