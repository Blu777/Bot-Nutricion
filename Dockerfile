# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Copy SQL schema for reference (used manually, not auto-run)
COPY src/db/schema.sql ./schema.sql

# Run as non-root for security
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
