# syntax=docker/dockerfile:1
# OPS-1: backend image เดียวใช้ได้ทั้ง server และ worker — เลือกด้วย env MEDUSA_WORKER_MODE
# (server|worker) และ DISABLE_MEDUSA_ADMIN ตอนรัน (docs/spec/07-scaling-ops.md)
# build จาก root ของ repo: docker build -f apps/backend/Dockerfile .
ARG NODE_VERSION=22.23.4

FROM node:${NODE_VERSION}-bookworm-slim AS base
# เวอร์ชันตรงกับ "packageManager" ใน package.json ที่ root
RUN npm install -g pnpm@12.15.0
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter @dtc/backend
COPY apps/backend apps/backend
# medusa build → apps/backend/.medusa/server (backend ที่ compile แล้ว + admin build)
RUN pnpm --filter @dtc/backend build
# production dependencies ตาม lockfile แยกออกมาเป็น directory เดี่ยว
RUN pnpm --filter @dtc/backend deploy --prod --legacy /deploy

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/backend/.medusa/server ./
USER node
EXPOSE 9000
# server: `medusa start` (default) | migrations: `db:migrate` — /health มาจาก `medusa start`
ENTRYPOINT ["/app/node_modules/.bin/medusa"]
CMD ["start"]
