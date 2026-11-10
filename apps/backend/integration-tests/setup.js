const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// PAY-1: Stripe provider ต้องมี key ตอนบูต — test ใช้ค่า dummy (Stripe ถูก mock ไม่ออก network)
// dev/prod ไม่ผ่านไฟล์นี้ จึงยังล้มทันทีถ้าไม่ได้ตั้ง STRIPE_API_KEY
process.env.STRIPE_API_KEY ??= "sk_test_dummy"
process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_dummy"
// CORE-7: medusa-config.ts เปิด featureFlags.translation แล้ว แต่ test runner require link-modules ก่อนโหลด
// project config → read-only link store_locale ↔ locale (link-modules/definitions/readonly/store-locale)
// ถูกข้ามเพราะเช็ก flag ตอน require จึงตั้ง env ที่นี่ให้ตรงกับ server จริง (medusa develop/start ไม่ต้องตั้ง)
process.env.MEDUSA_FF_TRANSLATION = "true"
// OPS-15b (spec 07 AC-26): cron ของ src/jobs ไม่ลงทะเบียนใน integration test (src/lib/scheduled-jobs.ts) —
// cron ที่รันเองซ้อนกับการ restore DB ของ runner ทำให้ connection ถูก terminate; test เรียก job function ตรงแทน
process.env.MEDUSA_DISABLE_SCHEDULED_JOBS = "true"
