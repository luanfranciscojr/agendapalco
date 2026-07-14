FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN corepack prepare pnpm@11.7.0 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm db:generate
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3001

CMD ["sh", "-c", "pnpm db:push && node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3001}"]
