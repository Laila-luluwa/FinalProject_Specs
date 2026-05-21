# LeanStock Backend

Production-grade multi-tenant POS / inventory API: orders with ACID stock deduction, inter-shop transfers, dead-stock pricing, JWT auth with email verification, RBAC, and Redis-backed async workers.

## Tech stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 5 |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + refresh token rotation |
| Queue | BullMQ + Redis |
| Email | Nodemailer (SMTP) |
| API docs | OpenAPI 3 + Swagger UI at `/docs` |

## Prerequisites

- Node.js 18+
- PostgreSQL
- Redis (for BullMQ email and dead-stock workers)

## Setup

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, SMTP credentials

npm install
npx prisma migrate deploy
npm run seed

# Start Redis locally, then:
npm run dev
```

### Postman (pre-defense)

Import from `postman/`:

- `LeanStock-Defense.postman_collection.json`
- `LeanStock-Defense.postman_environment.json`

Step-by-step demo: see `postman/DEFENSE-RUNBOOK.md`.

Demo users (after seed): `manager@defense.local`, `cashier@defense.local`, `auditor@defense.local` — password `Defense123!`

Server: `http://localhost:3000`  
Swagger: `http://localhost:3000/docs`

## Environment validation

The app **refuses to start** if `DATABASE_URL` or `JWT_SECRET` are missing. In `NODE_ENV=production`, SMTP variables are also required and wildcard CORS is blocked.

## Architecture

```
routes/     → HTTP, auth guards, pagination
services/   → Business logic + Prisma transactions
middleware/ → JWT, RBAC, rate limits, errors
lib/        → Prisma client, env, pagination, pure formulas
prisma/     → Schema + migrations (source of truth)
```

### Roles (RBAC)

| Role | Typical access |
|------|----------------|
| OWNER | Users, delete products, audit |
| MANAGER | Products CRUD, inventory transfer, jobs |
| CASHIER | Create orders (assigned by OWNER) |
| VIEWER | Default on self-registration; read-only |
| AUDITOR | Audit logs |

Unverified users receive **403** on login until email is verified.

### Business workflows

1. **Order** — `POST /orders` (auth): validates tenant shop, checks stock, transaction decrements inventory, creates order + audit log, queues **order confirmation email**.
2. **Stock transfer** — `POST /inventory/transfer` (MANAGER): ACID move between shops, **transfer email**, audit log.
3. **Dead stock** — BullMQ repeatable job every hour + `POST /api/jobs/dead-stock/trigger`; updates prices + **price decay email** to managers.

### Email events (async via BullMQ)

| Event | Trigger |
|-------|---------|
| Verification | Registration |
| Password reset | Forgot password |
| Welcome | Email verified |
| Order confirmation | Order created |
| Stock transfer | Transfer completed |
| Price decay | Cron / manual dead-stock job |

Emails are **queued** — API responses do not wait for SMTP.

### Background jobs

- **Queue**: `email` (BullMQ Worker in `services/email.queue.js`)
- **Queue**: `dead-stock` (hourly cron in `services/background.queue.js`)
- **Visibility**: `GET /api/jobs/queues` (OWNER/MANAGER)

## API overview

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | Public |
| GET | `/auth/verify-email?token=` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/refresh` | Public |
| POST | `/auth/logout` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| GET | `/auth/me` | Bearer |
| GET/POST | `/orders` | Bearer |
| GET | `/products` | Bearer (paginated) |
| POST | `/inventory/transfer` | MANAGER |
| GET | `/audit-logs` | OWNER/AUDITOR |
| GET | `/api/jobs/queues` | OWNER/MANAGER |

List endpoints support `?page=1&limit=10`.

## Testing

```bash
npm test
```

Unit tests cover RBAC, password strength, dead-stock formula, and order totals. Integration tests live under `__tests__/integration/` (skipped by default).

## Pre-defense checklist

1. Start PostgreSQL + Redis + app (`npm run dev`).
2. Postman: auth flow (register → verify email in inbox → login → protected route → refresh → logout).
3. Business: create order, transfer stock — show emails in inbox.
4. `GET /api/jobs/queues` — show BullMQ job counts.
5. `POST /api/jobs/dead-stock/trigger` — demonstrate worker.
6. Open `/docs` and run `npm test`.

## Migrations

All schema changes are in `prisma/migrations/`. Never use raw SQL in application code — only Prisma Client.

## License

Academic / final project.
