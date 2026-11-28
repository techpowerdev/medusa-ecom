import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { buildNotificationProviders } from './src/lib/notification-providers'
import { checkBootEnv } from './src/lib/prod-guards'
import { buildDatabaseDriverOptions, buildInfraModules, getRedisModulesUrl } from './src/lib/infra-modules'
import { buildJsonLogger } from './src/lib/json-logger'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// OPS-2: Redis modules เฉพาะ production ที่ตั้ง REDIS_URL (src/lib/infra-modules.ts)
const redisUrl = getRedisModulesUrl(process.env)

// OPS-7 (AC-13, AC-17): production ขาด AFFILIATE_TOKEN_SECRET / STOREFRONT_URL → throw; นอก prod เตือนครั้งเดียวตอนบูต
// OPS-13 (AC-20): production ที่ตั้ง ALLOW_TEST_PROVIDERS=true เตือนครั้งเดียวตอนบูต (ยังบูตได้ — CI ใช้)
// OPS-31 (AC-46a): `medusa db:migrate` fork process ลูก (db:migrate:search/scripts) ที่สืบทอด env แล้วโหลด config ซ้ำ
// → guard ยังตรวจทุก process แต่ warning ออกครั้งเดียวทั้ง process tree (ตัวแปร env ส่งต่อให้ลูก)
const bootWarnings = checkBootEnv(process.env)
if (process.env.MEDUSA_CONFIG_WARNED !== 'true') {
  for (const warning of bootWarnings) {
    console.warn(`[medusa-config] ${warning}`)
  }
  process.env.MEDUSA_CONFIG_WARNED = 'true'
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: buildDatabaseDriverOptions(process.env),
    redisUrl,
    // OPS-1: image เดียวกันบูตเป็น server/worker ตาม env (docs/spec/07-scaling-ops.md)
    workerMode: (process.env.MEDUSA_WORKER_MODE ?? 'shared') as 'shared' | 'worker' | 'server',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
  },
  modules: [
    {
      resolve: '@medusajs/medusa/notification',
      options: { providers: buildNotificationProviders(process.env) },
    },
    {
      resolve: './src/modules/evoucher',
      options: { encryptionKey: process.env.EVOUCHER_ENCRYPTION_KEY },
    },
    {
      resolve: './src/modules/flash_sale',
    },
    {
      resolve: './src/modules/group_buy',
    },
    {
      resolve: './src/modules/affiliate',
      // AF-2: secret ของ cookie `aff` / cart metadata.affiliate_token (spec 05 "Cart hook")
      options: { tokenSecret: process.env.AFFILIATE_TOKEN_SECRET },
    },
    {
      // EV-3 (ADR-006): manual (Standard) + digital (Digital delivery → digital_digital)
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
          { resolve: './src/modules/digital_fulfillment', id: 'digital' },
        ],
      },
    },
    {
      // spec 06 / ADR-007: Stripe provider ทางการ → pp_stripe_stripe (บัตร) + pp_stripe-promptpay_stripe
      // webhook: endpoint เดียว /hooks/payment/stripe_stripe รับ event ของทั้งบัตรและ PromptPay (ADR-023 — secret ค่าเดียว)
      // PAY-26 (ADR-035): subclass provider ของ Medusa ให้บัตร + พร้อมเพย์ใช้ Stripe customer ตัวเดียว (id/provider id เดิม)
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: './src/modules/stripe-shared-customer',
            id: 'stripe',
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
              capture: true,
              automaticPaymentMethods: false,
            },
          },
        ],
      },
    },
    // CORE-7 (ADR-008): เนื้อหาสินค้าหลายภาษา — experimental ต้องเปิดคู่กับ featureFlags.translation
    { resolve: '@medusajs/medusa/translation' },
    ...buildInfraModules(process.env, redisUrl),
  ],
  featureFlags: {
    translation: true,
  },
  // OPS-3 (spec 07 AC-18): log JSON มี field worker_mode สำหรับ alert ของ worker (src/lib/json-logger.ts)
  logger: buildJsonLogger(process.env),
})
