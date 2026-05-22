# LeanStock — Defense Video Script (4–6 min)

Upload: YouTube → **Unlisted** → paste link in `VIDEO_LINK.txt`

Use **live Render URL** if ready; otherwise say: *"Production on Render; demo also works locally at localhost:3000."*

---

## 0:00–0:30 — Intro + live URL

- Open browser: `https://YOUR-SERVICE.onrender.com` (or `http://localhost:3000`)
- Show `/api/status` → `healthy`
- One sentence: *"LeanStock — multi-tenant inventory, Express, Prisma, PostgreSQL, BullMQ, Brevo email."*

---

## 0:30–1:30 — Auth + REAL email (обязательно)

**On deployed URL (preferred):**

1. Register: new company + **your real Gmail**
2. Switch to Gmail → show **verification email** (Brevo)
3. Click verify link → back to app → **Login**
4. Optional: Forgot password → reset email in inbox

Say: *"Unverified users get 403 on protected routes."*

---

## 1:30–3:00 — Business workflow on FRONTEND (не Postman)

Logged in as OWNER or MANAGER (`owner@defense.local` / `Defense123!` after seed if needed):

1. **Products** — create or show list
2. **Order** — place order → mention stock deducted (ACID)
3. **Transfer** — move stock between shops
4. Show **email** in inbox: order confirmation OR transfer (business email)

Say: *"Tenant isolation — every query scoped by tenantId from JWT."*

---

## 3:00–3:45 — Background worker + Redis

1. Open tab **Workers** (or `GET /api/jobs/queues` in Swagger)
2. Show queue stats (email / dead-stock)
3. Trigger dead-stock job → logs / updated prices
4. Say: *"Emails queued in BullMQ — API does not block on SMTP."*

---

## 3:45–4:30 — Tests

In terminal (can be local):

```bash
npm test
```

Point to: RBAC test, dead-stock formula, register OWNER role.

Say: *"Integration tests prove auth and atomic boundaries."*

---

## 4:30–5:30 — Swagger + Docker + trade-off

1. Open `/docs` — scroll Auth, Tenants, Orders, Transfer
2. Optional 10 sec: `docker compose ps` (4 services Up) on laptop
3. **Trade-off (обязательно одна фраза):**
   - *"Blueprint listed forecasting and PO; I delivered core inventory, transfer, dead-stock cron, and async email first; forecasting is Phase 2 in CHANGELOG."*
   - OR if you implemented everything you claim — pick another trade-off (offset pagination vs cursor).

---

## 5:30–6:00 — Outro

- GitHub: `Laila-luluwa/FinalProject_Specs`
- `DEPLOYED_URL.txt` matches browser URL
- Thank you / end

---

## Recording tips

- Resolution 1080p, speak clearly, no music
- **Unlisted** YouTube (not Private — instructors need link)
- Rehearse once with `postman/DEFENSE-RUNBOOK.md` open off-screen
