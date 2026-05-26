# ─── Dependencies ──────────────────────────────────────────────────────────
# Build context is the repo root (see docker-compose.prod.yml) so we can
# pull in the shared prisma/ directory without dealing with the symlink.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY web/package*.json ./
RUN npm ci

# ─── Build ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY web/package*.json web/tsconfig.json web/next.config.mjs web/next-env.d.ts ./
COPY web/src ./src
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

# ─── Runtime (Next.js standalone output) ──────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache openssl

# Standalone output gives us a minimal node_modules + server.js bundle.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Prisma needs the schema at runtime for the query engine to load.
COPY --from=build /app/prisma ./prisma
# Standalone strips Prisma engines from node_modules; ship them explicitly.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["node", "server.js"]
