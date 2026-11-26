import { getI18n } from "react-i18next"

import type resources from "./index"

export type EcomNamespace = keyof (typeof resources)["en"]

/**
 * spec 10 กฎ 4b (ADR-031 ข้อ 4): แปลข้อความนอก component (lib, ข้อความ zod แบบ lazy, `handle.breadcrumb`) ด้วย instance
 * ของ i18next ที่ dashboard ใช้ (`getI18n()` ของ react-i18next — pre-bundle ร่วมกับ dashboard)
 * เรียกตอนรันเท่านั้น: ยังไม่มี instance (โหลด module ก่อน `<I18n/>` ของ dashboard init) → throw ให้รู้ทันที (กฎ 4c)
 */
export const t = (ns: EcomNamespace, key: string, options?: Record<string, unknown>): string => {
  const i18n = getI18n()
  if (!i18n) {
    throw new Error(`i18n ยังไม่ init — ห้ามเรียก t ตอนโหลด module (spec 10 กฎ 4): ${ns}:${key}`)
  }
  return i18n.t(key, { ns, ...options }) as string
}
