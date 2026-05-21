# API Changelog

Deviations from original blueprint openapi (architectural justification):

- **Offset pagination** (`page`, `limit`) instead of cursor — simpler for defense demo; responses use `{ data, pagination }`.
- **`POST /transfer`** — alias of `POST /inventory/transfer` for shorter public path.
- **`GET /api/jobs/email-queue-stats`** — alias returning email queue counts only (frontend compatibility).
- **`POST /api/jobs/trigger-dead-stock`** — alias of `POST /api/jobs/dead-stock/trigger`.
- **Dual route prefix** — core API under `/auth`, `/orders`, …; legacy OAuth under `/api/auth`, `/api/users`.
- **Serializable transactions** — Prisma `isolationLevel: 'Serializable'` on order/transfer instead of raw `SELECT FOR UPDATE` (ORM-only policy).
