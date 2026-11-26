// spec 10 กฎ 16 (AI18N-1): instance แยกของ i18next สำหรับ unit — `initReactI18next` ตั้งให้ `getI18n()` (ที่ helper `i18n/t.ts` ใช้)
// คืน instance นี้; ห้าม init instance กลาง (`i18next` default) เพราะ `optionalInt`/`optionalFloat` ของ `@medusajs/dashboard/lib`
// เรียก `i18next.t(...)` ตอนโหลด module และ unit เดิมพึ่งผล "Invalid input"
// `initImmediate: false` = init เสร็จแบบ synchronous (setupFiles รอ promise ไม่ได้); ตัวเลือกอื่นตาม `defaultI18nOptions` ของ dashboard
import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import resources from "../i18n"

void i18next.createInstance().use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  initImmediate: false,
  interpolation: { escapeValue: false },
})
