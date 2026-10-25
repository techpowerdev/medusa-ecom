// infrastructure modules ของ prod (OPS-2, docs/spec/07-scaling-ops.md) — ใช้ใน medusa-config.ts
// ทุกอย่างเป็น module/provider ทางการของ Medusa ที่มากับ @medusajs/medusa และเปิดตาม env เท่านั้น:
// - NODE_ENV=production + REDIS_URL → event bus, workflow engine, caching, locking บน Redis + session store
//   (dev `medusa develop` = development, jest/medusa-test-utils = test → in-memory ของ Medusa ตามเดิม
//   แม้ .env ในเครื่องจะมี REDIS_URL)
// - S3_BUCKET → File Module ใช้ provider S3 (ไม่มี = file-local ของ Medusa)
// - DATABASE_POOL_MIN/MAX → pool ของ pg (ไม่ตั้ง = default ของ Medusa)
import { MedusaError } from "@medusajs/framework/utils"

type Env = Record<string, string | undefined>

export const getRedisModulesUrl = (env: Env): string | undefined => {
  if (env.NODE_ENV === "production" && env.REDIS_URL) {
    return env.REDIS_URL
  }
  if (env.NODE_ENV === "production" && ["server", "worker"].includes(env.MEDUSA_WORKER_MODE ?? "")) {
    // event bus in-memory ส่ง event ข้าม process ไม่ได้ → subscriber บน worker จะไม่ได้รับ event จาก server
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `MEDUSA_WORKER_MODE=${env.MEDUSA_WORKER_MODE} ต้องตั้ง REDIS_URL ใน production (Redis event bus/workflow engine)`
    )
  }
  return undefined
}

export const buildDatabaseDriverOptions = (env: Env) => {
  if (!env.DATABASE_POOL_MIN && !env.DATABASE_POOL_MAX) {
    return undefined
  }
  return {
    pool: {
      ...(env.DATABASE_POOL_MIN ? { min: Number(env.DATABASE_POOL_MIN) } : {}),
      ...(env.DATABASE_POOL_MAX ? { max: Number(env.DATABASE_POOL_MAX) } : {}),
    },
  }
}

const redisModules = (redisUrl: string) => [
  {
    resolve: "@medusajs/medusa/event-bus-redis",
    options: { redisUrl },
  },
  {
    resolve: "@medusajs/medusa/workflow-engine-redis",
    options: { redis: { redisUrl } },
  },
  {
    // Caching Module แทน Cache Module (deprecated ตั้งแต่ v2.11) — core จะใช้ cache นี้เมื่อเปิด MEDUSA_FF_CACHING=true
    resolve: "@medusajs/medusa/caching",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/caching-redis",
          id: "caching-redis",
          is_default: true,
          options: { redisUrl },
        },
      ],
    },
  },
  {
    resolve: "@medusajs/medusa/locking",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/locking-redis",
          id: "locking-redis",
          is_default: true,
          options: { redisUrl },
        },
      ],
    },
  },
]

const s3FileModule = (env: Env) => ({
  resolve: "@medusajs/medusa/file",
  options: {
    providers: [
      {
        resolve: "@medusajs/medusa/file-s3",
        id: "s3",
        options: {
          // URL สาธารณะของไฟล์ — ชี้ไปที่ CDN หน้า bucket ได้ (docs/ops/cdn.md)
          file_url: env.S3_FILE_URL,
          access_key_id: env.S3_ACCESS_KEY_ID,
          secret_access_key: env.S3_SECRET_ACCESS_KEY,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET,
          endpoint: env.S3_ENDPOINT,
        },
      },
    ],
  },
})

export const buildInfraModules = (env: Env, redisUrl: string | undefined) => [
  ...(redisUrl ? redisModules(redisUrl) : []),
  ...(env.S3_BUCKET ? [s3FileModule(env)] : []),
]
