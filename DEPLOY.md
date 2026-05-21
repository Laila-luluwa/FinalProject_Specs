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

`DATABASE_URL` and `REDIS_URL` are already set in `docker-compose.yml` using service names `postgres` and `redis` — **do not use localhost** there.

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
- **Build:** `npm ci && npx prisma generate && npx prisma migrate deploy`
- **Start:** `node app.js`
- **Health check:** `/api/status`

**Environment:**

```
NODE_ENV=production
DATABASE_URL=<Render Postgres internal URL>
REDIS_URL=<Upstash URL>
JWT_SECRET=<random 32+ chars>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail>
SMTP_PASS=<app password>
EMAIL_FROM=LeanStock <gmail>
APP_URL=https://YOUR-SERVICE.onrender.com
CLIENT_URL=https://YOUR-SERVICE.onrender.com
CORS_ORIGINS=https://YOUR-SERVICE.onrender.com
PORT=10000
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
| Backend Restarting | `docker compose logs backend` — often SMTP missing when `NODE_ENV=production` |
| CORS error | `CORS_ORIGINS` must match exact browser URL (https) |
| No verify email | Check Redis + SMTP env on platform |
| DeployRocks only shows API | Open frontend URL or path `/` on main domain |

---

## After deploy

1. Update **`DEPLOYED_URL.txt`**
2. Record **`VIDEO_LINK.txt`**
3. Mark **`CHECKLIST.txt`**
