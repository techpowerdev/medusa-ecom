import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { buildNotificationProviders } from './src/lib/notification-providers'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
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
    { resolve: './src/modules/affiliate' },
    {
      // spec 06 / ADR-007: Stripe provider ทางการ → pp_stripe_stripe (บัตร) + pp_stripe-promptpay_stripe
      // webhook: /hooks/payment/stripe_stripe และ /hooks/payment/stripe-promptpay_stripe
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/payment-stripe',
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
  ],
  featureFlags: {
    translation: true,
  },
})
