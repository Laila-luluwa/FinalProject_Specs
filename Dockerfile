FROM node:20-alpine

# Prisma + native modules on Alpine
RUN apk add --no-cache openssl libc6-compat python3 make g++

WORKDIR /app

COPY package*.json ./
# npm install (not ci) — lock file must match package.json; run `npm install` locally after dependency changes
RUN npm install --omit=dev --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh && chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

CMD ["sh", "scripts/docker-entrypoint.sh"]
