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

# OPS-6: ใช้ output: "standalone" (next.config.js) — ก๊อปเฉพาะไฟล์ที่ next trace ไว้ใน .next/standalone
# (root ของ trace คือ workspace root → server.js อยู่ที่ apps/storefront/) ส่วน static/public ต้องก๊อปเอง
# NEXT_PUBLIC_* ถูกฝังใน bundle ตอน build แล้ว และ server.js ไม่โหลด next.config.js ซ้ำ → ไม่ต้องตั้ง env ตอน run
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=node:node /repo/apps/storefront/public ./apps/storefront/public
USER node
WORKDIR /app/apps/storefront
EXPOSE 8000
CMD ["node", "server.js"]
