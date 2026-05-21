# Защита — порядок кликов в Postman (≈12 мин)

## Импорт

1. Postman → **Import** → `LeanStock-Defense.postman_collection.json`
2. **Import** → `LeanStock-Defense.postman_environment.json`
3. Справа сверху выберите environment **LeanStock Defense**

## Подготовка (до комиссии)

```bash
npm install
npx prisma migrate deploy
node seed.js
npm run dev
```

Redis должен быть запущен (для `/api/jobs/queues` и email).

После `node seed.js` скопируйте в environment, если id не 1:

- `tenantId`
- `shopId` = Shop A
- `shopIdFrom` = Shop A
- `shopIdTo` = Shop B
- `productId`

Пароль всех demo-пользователей: **Defense123!**

## Сценарий на защите

| # | Запрос | Кто залогинен |
|---|--------|----------------|
| 1 | 00 — Health Check | — |
| 2 | 01 — Login — Manager | manager |
| 3 | 01 — Me | manager |
| 4 | 02 — Create Product | manager |
| 5 | 01 — Login — Cashier | cashier |
| 6 | 02 — Create Order | cashier |
| 7 | 01 — Login — Manager | manager |
| 8 | 02 — Transfer Stock | manager |
| 9 | 01 — Login — Auditor | auditor |
| 10 | 03 — Audit Logs | auditor |
| 11 | 01 — Login — Manager | manager |
| 12 | 03 — Queue Stats | manager |
| 13 | 01 — Refresh Token | любой |
| 14 | 01 — Logout | любой |

Показать письма: Register (опционально) или Forgot Password + inbox.

Браузер: `http://localhost:3000/docs`

Терминал: `npm test`
