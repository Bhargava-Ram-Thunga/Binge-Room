FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/event-schema/package.json ./packages/event-schema/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @syncstream/shared-types build
RUN pnpm --filter @syncstream/shared-utils build
RUN pnpm --filter @syncstream/event-schema build
RUN pnpm --filter @syncstream/server build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json .
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/index.js"]
