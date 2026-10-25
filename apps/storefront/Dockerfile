# syntax=docker/dockerfile:1
# OPS-1: storefront image (Next.js starter) — build จาก root ของ repo:
#   docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_... .
# NEXT_PUBLIC_* ถูกฝังลง bundle ตอน build จึงต้องส่งเป็น build arg (ไม่ใช่ secret)
ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-bookworm-slim AS build
# เวอร์ชันตรงกับ "packageManager" ใน package.json ที่ root
RUN npm install -g pnpm@12.15.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/storefront/package.json apps/storefront/
RUN pnpm install --frozen-lockfile --filter @dtc/storefront
COPY apps/storefront apps/storefront
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION=dk
ARG NEXT_PUBLIC_STRIPE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @dtc/storefront build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# next.config.js ตรวจ NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ตอน start ด้วย
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY}
WORKDIR /repo
COPY --from=build --chown=node:node /repo ./
USER node
WORKDIR /repo/apps/storefront
EXPOSE 8000
CMD ["node_modules/.bin/next", "start", "-p", "8000"]
