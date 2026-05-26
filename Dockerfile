FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
# Run migrations before starting — safe to run repeatedly (idempotent)
CMD ["sh", "-c", "npm run db:deploy && node dist/index.js"]
