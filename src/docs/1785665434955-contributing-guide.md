# Plan: Create CONTRIBUTING.md Documentation

## Goal
Write a production-ready `CONTRIBUTING.md` at the repository root that explains the project, code architecture, data flow, code style, and contribution workflow — so external contributors (like the user's friends) can onboard safely without breaking the system.

## Files to Create / Modify
- **Create:** `CONTRIBUTING.md` at repo root (`C:\Users\hp\OneDrive - Himalayan WhiteHouse International College\Desktop\nest js\backend\CONTRIBUTING.md`)
- **Remove or replace:** `src/docs/contributing-guide.md` (currently contains plan notes, not the actual guide)

## Exact Content to Write

The implementing agent should write the following exact sections and content into `CONTRIBUTING.md`:

---

```markdown
# Contributing to Invoicing & Business Finance Tracker (Backend)

Welcome! This guide exists to help you — whether you're a first-time open-source contributor or an experienced NestJS developer — understand how this backend works and how to contribute safely.

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming and respectful environment for everyone.

---

## Project Overview

This is a **NestJS + TypeScript** backend for business owners to register their business, manage customers, and track invoices and financial activity. Data is stored in a **Neon-hosted PostgreSQL** database using **TypeORM**.

### Current State of Development

| Feature | Status |
|---------|--------|
| **Authentication** (JWT-based, business & customer roles) | ✅ Implemented |
| **Business registration** | ✅ Implemented |
| **Customer registration** (DTO-validated) | ✅ Implemented |
| **Business–Customer linking** (dedicated join model) | ✅ Implemented |
| **Invoice creation** (`invoice_items` module) | 🚧 In Progress |
| **Contact module** | 🚧 In Progress |
| **Swagger API docs** | 📋 Planned |
| **Full test coverage** | 📋 Planned |

### Long-Term Goal
Build a complete invoicing system where every business can independently manage its own customers and financial records in a multi-tenant architecture.

---

## Program Flow & Architecture

Understanding how requests flow through the system will help you write code that fits the existing patterns.

### 1. Bootstrap & Startup
- `src/main.ts` bootstraps `AppModule`.
- `AppModule` registers:
  - **ConfigModule** (global) — loads `.env` variables.
  - **TypeOrmModule.forRootAsync** — connects to Neon Postgres via `DATABASE_URL`. Currently has `synchronize: true` for development convenience (auto-updates schema from entities).
  - **All feature modules**: `AuthModule`, `BusinessModule`, `CustomersModule`, `BusinessCustomerModule`, `InvoiceItemsModule`, `ContactModule`.
- `src/main.ts` also adds a global `ValidationPipe` that:
  - Strips unknown fields (`whitelist: true`)
  - Rejects extra fields with an error (`forbidNonWhitelisted: true`)
  - Transforms payloads to match DTO classes (`transform: true`)

### 2. Request Lifecycle
Here is what happens when a client calls a protected endpoint (e.g., creating an invoice):

1. **HTTP Request** arrives at a NestJS **controller** method.
2. **Auth Guard Check**: If the route is protected, `JwtAuthGuard` validates the JWT from the `Authorization` header. If invalid or missing, the request is rejected with `401 Unauthorized`.
3. **Active User Extraction**: The controller uses the `@ActiveUser()` decorator to pull the authenticated user object from the request.
4. **DTO Validation**: The request body is validated by DTO classes using `class-validator`. Invalid data returns `400 Bad Request` before reaching the service.
5. **Service Logic**: The controller delegates to a **service** class. The service contains all business logic, authorization checks, and database operations.
6. **Database Operations**:
   - Simple reads/writes use **TypeORM repositories** (`@InjectRepository`).
   - Multi-step operations (like creating an invoice with multiple line items) use a **QueryRunner** to wrap everything in a transaction. If any step fails, the transaction rolls back completely.
7. **Response**: The service returns a result, and the controller sends it back as JSON.

### 3. Auth Flow
```
Client                          Backend
  |                                |
  |-- POST /auth/login (email, password) -->|
  |                                |
  |    AuthService verifies credentials     |
  |                                |
  |<-- { access_token: "jwt..." } --|
  |                                |
  |-- GET /protected-route (Authorization: Bearer jwt...) -->|
  |                                |
  |    JwtAuthGuard validates token        |
  |    @ActiveUser() extracts user         |
  |    Service executes logic              |
  |                                |
  |<-- { data: ... } --|
```

### 4. Database & Entity Flow
- **Entities** are TypeScript classes decorated with TypeORM decorators (`@Entity`, `@PrimaryColumn`, `@ManyToOne`, etc.). They map directly to database tables.
- **Repositories** handle CRUD operations. They are injected into services via `@InjectRepository(EntityClass)`.
- **Relations**: When fetching related data (e.g., a business with its owner), the `relations` option is passed to `findOne` or `findAll`.
- **Transactions**: For atomic operations, `DataSource.createQueryRunner()` is used. The pattern is:
  ```typescript
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    // create/save entities
    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
  ```

---

## Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- A **PostgreSQL connection string** (we recommend [Neon](https://neon.tech/) for a free cloud database)

### Installation

```bash
git clone <your-repo-url>
cd backend
npm install
```

### Environment Variables

Create a `.env` file in the project root with the following:

```env
PORT=3001
DATABASE_URL=your_postgres_connection_string_here
JWT_SECRET=your_jwt_secret_key_here
```

> **Important**: Never commit `.env` to version control. It is already included in `.gitignore`.

### Running the Application

```bash
# Development mode (auto-reloads on file changes)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server starts at `http://localhost:3001`.

### Running Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e

# Generate coverage report
npm run test:cov
```

---

## Contribution Workflow

We follow a standard Git-based workflow to keep the codebase stable and reviewable.

### 1. Fork & Clone
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/backend.git
   cd backend
   ```

### 2. Create a Branch
Always create a feature branch from `main`. Use a descriptive name:

```bash
# Good branch names
feat/add-invoice-summary
fix/auth-token-expiry
refactor/extract-user-dto

git checkout -b feat/add-invoice-summary
```

### 3. Make Your Changes
- Follow the **NestJS module structure** (see Code Standards below).
- Keep controllers thin; put all business logic in services.
- Use DTOs with `class-validator` decorators for any new endpoints.
- If you touch database entities, remember the app uses `synchronize: true` in development, but plan for migrations later (see note below).

### 4. Code Style & Lint
Before committing, run these commands:

```bash
# Format code with Prettier
npm run format

# Lint and auto-fix with ESLint
npm run lint

# Run tests to ensure nothing broke
npm run test
```

> **Prettier config**: Single quotes, trailing commas on multi-line structures. ESLint is configured to use Prettier, so formatting is enforced automatically.

### 5. Commit
Use clear, conventional commit messages:

```bash
git add .
git commit -m "feat(invoice): add invoice summary endpoint"
```

### 6. Push & Open a Pull Request
```bash
git push origin feat/add-invoice-summary
```

Then open a Pull Request on GitHub against the `main` branch. Your PR should include:
- A clear title and description of what changed and why.
- A link to the related issue (if applicable).
- Screenshots or curl examples for API changes.
- Confirmation that tests pass and coverage is maintained.

### 7. Database Changes Note
If you modify a TypeORM entity, the database schema will auto-update in development because `synchronize: true` is set. However, this is **not safe for production**. In the future, we will switch to **TypeORM migrations**. For now, just note any schema changes in your PR description so maintainers can plan the migration path.

---

## Code Standards

### NestJS Module Structure
Every feature module should follow this pattern:

```
src/<module-name>/
├── dto/
│   ├── create-<entity>.dto.ts
│   └── update-<entity>.dto.ts
├── entities/
│   └── <entity>.entity.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
└── <module-name>.module.ts
```

### Controllers
- Handle HTTP concerns only: route decorators, request/response mapping.
- Validate input via DTOs.
- Delegate all business logic to the service layer.
- Use `@ActiveUser()` to access the authenticated user when needed.

### Services
- Contain all business logic, authorization checks, and database calls.
- Use constructor injection for repositories and dependencies.
- Throw NestJS exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`) instead of returning error objects.

### DTOs & Validation
- Define request payloads as classes with TypeScript properties.
- Decorate fields with `class-validator` decorators (`@IsString`, `@IsNumber`, `@IsNotEmpty`, etc.).
- The global `ValidationPipe` in `main.ts` handles validation automatically.

### Entities
- Use TypeORM decorators (`@Entity`, `@PrimaryColumn`, `@Column`, `@ManyToOne`, `@OneToMany`, etc.).
- Keep entities focused on table mapping only — no business logic.
- Load relations explicitly using the `relations` option in repository queries.

### Transactions
- Wrap multi-step database writes in a `QueryRunner` transaction.
- Always `commitTransaction` on success and `rollbackTransaction` on failure.
- Always `release` the query runner in a `finally` block.

### Testing
- Write unit tests in `.spec.ts` files alongside the code they test.
- Use `@nestjs/testing` (`Test.createTestingModule`) for unit tests.
- Mock repositories and `DataSource` using Jest mocks.
- Test happy paths, authorization failures, and not-found scenarios.

### Imports
- Use **absolute imports** from `src/` (e.g., `import { BusinessEntity } from 'src/bussiness/entities/bussiness.entity'`).
- Do not use relative paths like `../../entities`.

---

## Issue Reporting

Found a bug or have a feature idea? Please open a GitHub Issue.

### Bug Reports
Include:
- **Clear title** — e.g., `[BUG] Invoice creation fails when customer has no email`
- **Steps to reproduce** — numbered list of exact actions
- **Expected behavior** — what should happen
- **Actual behavior** — what actually happens
- **Environment** — Node.js version, OS, database provider
- **Logs / Screenshots** — relevant error output or API request/response

### Feature Requests
Include:
- **Clear title** — e.g., `[FEATURE] Add invoice PDF export`
- **Use case** — why is this needed? Who benefits?
- **Proposed API shape** — suggested endpoint, method, request/response format
- **Alternatives considered** — any other approaches you thought of?

---

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Class-validator](https://github.com/typestack/class-validator)
- [Neon Postgres](https://neon.tech/docs)

---

Thank you for contributing! 🚀
```

---

## Implementation Steps

1. **Create** `CONTRIBUTING.md` at the repository root with the content above.
2. **Delete** `src/docs/contributing-guide.md` (or leave it empty / redirect to root `CONTRIBUTING.md`).
3. **Verify** the markdown renders correctly and all commands match `package.json` scripts.

## Validation
- Confirm `CONTRIBUTING.md` exists at the repo root.
- Confirm `src/docs/contributing-guide.md` is removed or replaced.
- Cross-check all commands (`npm run format`, `npm run lint`, `npm run test`, `npm run start:dev`) against `package.json`.
- Cross-check environment variables (`PORT`, `DATABASE_URL`, `JWT_SECRET`) against `src/main.ts` and `app.module.ts`.
