const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()

// CORE-7: medusa-config.ts เปิด featureFlags.translation แล้ว แต่ test runner require link-modules ก่อนโหลด
// project config → read-only link store_locale ↔ locale (link-modules/definitions/readonly/store-locale)
// ถูกข้ามเพราะเช็ก flag ตอน require จึงตั้ง env ที่นี่ให้ตรงกับ server จริง (medusa develop/start ไม่ต้องตั้ง)
process.env.MEDUSA_FF_TRANSLATION = "true"
