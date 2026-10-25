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
    { resolve: './src/modules/affiliate' },
  ],
})
