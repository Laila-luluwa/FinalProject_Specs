# Deploy LeanStock (Final Project)

Public URL goes in **`DEPLOYED_URL.txt`** after deploy.

---

## Option A — DeployRocks (required by course if it works)

### 1. Push latest code to GitHub

```bash
git add .
git commit -m "Prepare production deploy"
git push origin main
```

### DeployRocks: "Deploy the app first before setting environment variables"

1. **Do NOT save env yet** — cancel that form.
2. **Deploy now** once (uses `docker-compose.yml` defaults: `NODE_ENV=development`, DB/Redis hostnames).
3. After status **Live**, open **Environment** and add production SMTP + `APP_URL` + `CORS_ORIGINS`, set `NODE_ENV=production`.
4. **Redeploy**.

Local Docker: add a `.env` file with `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/leanstock` and `REDIS_URL=redis://redis:6379` (see `.env.example`).

### 2. DeployRocks dashboard

1. Open **https://dashboard.deployrocks.com**
2. Sign in with **GitHub**
3. **New project** → import **`Laila-luluwa/FinalProject_Specs`**
4. Deploy type: **Docker Compose** (use repo `docker-compose.yml`)
5. Set **environment variables** (Dashboard → Environment):

| Variable | Value (example) |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | long random string (32+ chars) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | Gmail **App Password** (not login password) |
| `EMAIL_FROM` | `LeanStock <your@gmail.com>` |
| `APP_URL` | `https://YOUR-APP.deployrocks.com` (after first deploy) |
| `CLIENT_URL` | same as `APP_URL` |
| `CORS_ORIGINS` | same as `APP_URL` (exact HTTPS, no `*`) |

### Link database & Redis (DeployRocks dashboard)

Postgres and Redis show **Linked** but the **backend** still needs connection strings in **Environment**:

1. Open **postgres** resource (`…-postgres`) → copy **Connection URL** / **DATABASE_URL**
2. Open **redis** resource → copy **REDIS_URL** (or `redis://…`)
3. App → **Environment** → add:
   - `DATABASE_URL` = pasted Postgres URL
   - `REDIS_URL` = pasted Redis URL  
   **Do not use `localhost`** — use the URL from the dashboard.

If there is a **Link to app** button on postgres/redis, link them to **backend** — some setups inject vars automatically.

Local Docker uses defaults `postgres:5432` / `redis:6379` from `docker-compose.yml`.

6. **Deploy** and wait until all services are green.
7. Open the generated URL (usually the **frontend** on port 80 → your public domain).
8. Copy URL into **`DEPLOYED_URL.txt`**, commit, push.

### 3. Seed production DB (once)

In DeployRocks shell / exec on **backend** service:

```bash
node seed.js
```

### 4. Verify (examiner checklist)

- [ ] `https://YOUR-URL/` — LeanStock UI (Login/Register)
- [ ] `https://YOUR-URL/api/status` — `healthy`
- [ ] `https://YOUR-URL/docs` — Swagger
- [ ] Register with **real Gmail** → verification email in inbox
- [ ] Login → order or transfer → business email

---

## Option B — Render (if DeployRocks fails)

DeployRocks needs full Compose; Render free tier often uses **one Web Service** + managed Postgres + Upstash Redis.

### 1. PostgreSQL on Render

- New → **PostgreSQL** → copy **Internal Database URL**

### 2. Redis on Upstash

- https://console.upstash.com → Redis → copy `REDIS_URL`

### 3. Web Service

- New → **Web Service** → connect GitHub repo
- **Build:** `npm install && npx prisma generate && npx prisma migrate deploy`
- **Start command:** `node app.js` (or `npm start`)
- **Health check path:** `/api/status`
- Do **not** set `PORT` manually — Render injects it; app binds `0.0.0.0:PORT`.

**Environment (delete `REDIS_HOST` / `REDIS_PORT` if present):**

```
NODE_ENV=production
DATABASE_URL=<Render Postgres Internal URL>
REDIS_URL=<Upstash TCP URL, starts with rediss://>
JWT_SECRET=<random 32+ chars>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail>
SMTP_PASS=<Gmail app password>
EMAIL_FROM=LeanStock <gmail>
APP_URL=https://YOUR-SERVICE.onrender.com
CLIENT_URL=https://YOUR-SERVICE.onrender.com
CORS_ORIGINS=https://YOUR-SERVICE.onrender.com
```

UI + API on same URL (Express serves `frontend/`). Put URL in **`DEPLOYED_URL.txt`**.

### 4. Shell once: `node seed.js`

---

## Gmail App Password (real email)

1. Google Account → Security → 2-Step Verification ON  
2. App passwords → Mail → copy 16-char password → `SMTP_PASS`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Render: Port scan timeout / SIGTERM | App must listen on `0.0.0.0` before Redis; push latest `app.js`. Check logs for `FATAL: Missing` env. |
| Render: ECONNREFUSED 127.0.0.1:6379 | Set `REDIS_URL` (Upstash); remove `REDIS_HOST` / `REDIS_PORT` |
| Backend Restarting | `docker compose logs backend` — often SMTP missing when `NODE_ENV=production` |
| CORS error | `CORS_ORIGINS` must match exact browser URL (https) |
| No verify email | Check Redis + SMTP env on platform |
| DeployRocks only shows API | Open frontend URL or path `/` on main domain |

---

## After deploy

1. Update **`DEPLOYED_URL.txt`**
2. Record **`VIDEO_LINK.txt`**
3. Mark **`CHECKLIST.txt`**
