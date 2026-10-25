const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// PAY-1: Stripe provider ต้องมี key ตอนบูต — test ใช้ค่า dummy (Stripe ถูก mock ไม่ออก network)
// dev/prod ไม่ผ่านไฟล์นี้ จึงยังล้มทันทีถ้าไม่ได้ตั้ง STRIPE_API_KEY
process.env.STRIPE_API_KEY ??= "sk_test_dummy"
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_dummy"
