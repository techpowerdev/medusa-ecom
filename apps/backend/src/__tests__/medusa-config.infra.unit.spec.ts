// OPS-2 (docs/spec/07-scaling-ops.md deliverable 3): prod ใช้ Redis modules ของ Medusa
// (event bus, workflow engine, caching, locking) + pool size + S3 — เปิดตาม env เท่านั้น
// dev/test/CI ต้องได้ module in-memory/local ของ Medusa ตามเดิม
type ModuleConfig = { resolve?: string; options?: Record<string, any> }
type LoadedConfig = {
  projectConfig: {
    redisUrl?: string
    databaseDriverOptions?: { pool?: { min?: number; max?: number } }
  }
  modules: Record<string, ModuleConfig>
}

const ENV_KEYS = [
  "NODE_ENV",
  "REDIS_URL",
  "MEDUSA_WORKER_MODE",
  "DATABASE_POOL_MIN",
  "DATABASE_POOL_MAX",
  "S3_FILE_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ENDPOINT",
] as const

type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>

const PROD_GUARD_ENV = {
  ALLOW_TEST_PROVIDERS: "true",
  AFFILIATE_TOKEN_SECRET: "secret-from-env",
  STOREFRONT_URL: "https://shop.example.com",
}

function loadConfig(env: Env) {
  // ตั้งเป็น "" แทนการลบ — loadEnv() ใน medusa-config จะไม่เอาค่าจาก .env ในเครื่องมาทับ
  for (const key of ENV_KEYS) {
    process.env[key] = ""
  }
  // OPS-7: env ที่ prod guards บังคับ — test นี้ดูเฉพาะ infra modules
  Object.assign(process.env, PROD_GUARD_ENV, env)

  let config: LoadedConfig | undefined
  jest.isolateModules(() => {
    config = require("../../medusa-config")
  })
  return config as LoadedConfig
}

const PROD_REDIS: Env = {
  NODE_ENV: "production",
  REDIS_URL: "redis://redis.internal:6379",
}

const S3_ENV: Env = {
  S3_FILE_URL: "https://cdn.example.com",
  S3_ACCESS_KEY_ID: "key-from-env",
  S3_SECRET_ACCESS_KEY: "secret-from-env",
  S3_REGION: "ap-southeast-1",
  S3_BUCKET: "shop-assets",
  S3_ENDPOINT: "https://s3.ap-southeast-1.amazonaws.com",
}

describe("medusa-config infra modules (OPS-2)", () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it("uses Medusa's Redis modules in production when REDIS_URL is set", () => {
    const config = loadConfig(PROD_REDIS)
    const url = PROD_REDIS.REDIS_URL

    expect(config.projectConfig.redisUrl).toEqual(url)
    expect(config.modules.event_bus).toEqual(
      expect.objectContaining({
        resolve: "@medusajs/medusa/event-bus-redis",
        options: expect.objectContaining({ redisUrl: url }),
      })
    )
    expect(config.modules.workflows).toEqual(
      expect.objectContaining({
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl: url } },
      })
    )
    expect(config.modules.caching).toEqual(
      expect.objectContaining({
        resolve: "@medusajs/medusa/caching",
        options: {
          providers: [
            expect.objectContaining({
              resolve: "@medusajs/medusa/caching-redis",
              id: "caching-redis",
              is_default: true,
              options: { redisUrl: url },
            }),
          ],
        },
      })
    )
    expect(config.modules.locking).toEqual(
      expect.objectContaining({
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            expect.objectContaining({
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: url },
            }),
          ],
        },
      })
    )
  })

  it.each([
    ["dev (medusa develop)", { NODE_ENV: "development", REDIS_URL: "redis://localhost:6379" }],
    ["jest / medusa-test-utils", { NODE_ENV: "test", REDIS_URL: "redis://localhost:6379" }],
    ["production without REDIS_URL", { NODE_ENV: "production" }],
  ])("keeps Medusa's in-memory defaults for %s", (_label, env: Env) => {
    const config = loadConfig(env)

    expect(config.projectConfig.redisUrl).toBeUndefined()
    expect(config.modules.event_bus.resolve).toEqual("@medusajs/medusa/event-bus-local")
    expect(config.modules.workflows.resolve).toEqual("@medusajs/medusa/workflow-engine-inmemory")
    expect(config.modules.locking.resolve).toEqual("@medusajs/medusa/locking")
    expect(config.modules.locking.options).toBeUndefined()
    expect(config.modules.caching).toBeUndefined()
  })

  it.each(["server", "worker"])(
    "refuses to boot MEDUSA_WORKER_MODE=%s in production without REDIS_URL (in-memory event bus cannot cross processes)",
    (mode) => {
      expect(() => loadConfig({ NODE_ENV: "production", MEDUSA_WORKER_MODE: mode })).toThrow(
        /REDIS_URL/
      )
    }
  )

  it("sets the pg pool size from DATABASE_POOL_MIN/MAX", () => {
    const config = loadConfig({ DATABASE_POOL_MIN: "2", DATABASE_POOL_MAX: "20" })

    expect(config.projectConfig.databaseDriverOptions).toEqual(
      expect.objectContaining({ pool: { min: 2, max: 20 } })
    )
  })

  it("leaves Medusa's default pool when DATABASE_POOL_* is unset", () => {
    const config = loadConfig({})

    expect(config.projectConfig.databaseDriverOptions?.pool).toBeUndefined()
  })

  it("uses the S3 file provider when S3_BUCKET is set", () => {
    const config = loadConfig(S3_ENV)

    expect(config.modules.file).toEqual(
      expect.objectContaining({
        resolve: "@medusajs/medusa/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/file-s3",
              id: "s3",
              options: {
                file_url: S3_ENV.S3_FILE_URL,
                access_key_id: S3_ENV.S3_ACCESS_KEY_ID,
                secret_access_key: S3_ENV.S3_SECRET_ACCESS_KEY,
                region: S3_ENV.S3_REGION,
                bucket: S3_ENV.S3_BUCKET,
                endpoint: S3_ENV.S3_ENDPOINT,
              },
            },
          ],
        },
      })
    )
  })

  it("keeps Medusa's local file provider when S3 env is missing (dev/CI)", () => {
    const config = loadConfig({})

    expect(config.modules.file.options?.providers).toEqual([
      expect.objectContaining({ resolve: "@medusajs/medusa/file-local", id: "local" }),
    ])
  })
})
