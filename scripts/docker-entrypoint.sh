#!/bin/sh
set -e

echo "[entrypoint] Waiting for database and applying migrations..."
TRIES=0
MAX=15
until npx prisma migrate deploy; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX" ]; then
    echo "[entrypoint] migrate deploy failed — trying db push (docker dev fallback)..."
    if npx prisma db push --accept-data-loss; then
      break
    fi
    echo "[entrypoint] FATAL: database setup failed. Try: docker compose down -v && docker compose up -d --build"
    exit 1
  fi
  echo "[entrypoint] Migrate failed (attempt ${TRIES}/${MAX}), retry in 3s..."
  sleep 3
done

echo "[entrypoint] Starting API on port ${PORT:-3000}..."
exec node app.js
