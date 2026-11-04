import { z } from "zod"
import type { Partner } from "./evoucher"
import { fieldErrorMap } from "./form-validation"

// ADM-5 (spec 08 AC-8, กฎ 8): ฟอร์มสร้าง/แก้ partner ใน "Partners" ของหน้า E-vouchers (EV-6, spec 02)

export const NAME_REQUIRED_MESSAGE = "Name is required"
export const HTTP_URL_MESSAGE = "Must be an http:// or https:// URL"

// spec 02 กฎข้อ 26 (follow-up EV-14 #195): storefront render เป็น <a href>/<img src> — รับเฉพาะ http(s) เหมือน backend
// ตรวจด้วย protocol ที่ URL parser อ่านได้ (ไม่ใช่ regex ขึ้นต้น) ให้ผลตรงกับ browser
const isHttpUrl = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const trimmedOrNull = z
  .string()
  .trim()
  .transform((value) => value || null)

const optionalHttpUrl = z
  .string()
  .trim()
  .refine((value) => value === "" || isHttpUrl(value), { message: HTTP_URL_MESSAGE })
  .transform((value) => value || null)

export const partnerFormSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE),
  logo_url: optionalHttpUrl,
  terms_url: optionalHttpUrl,
  // ค่าว่าง → null เพื่อให้ล้างค่าเดิมได้ (validator ของ backend รับ nullish)
  support_contact: trimmedOrNull,
})

export type PartnerFormValues = z.input<typeof partnerFormSchema>

export const PARTNER_PARSE_OPTIONS = {
  error: fieldErrorMap({ name: NAME_REQUIRED_MESSAGE, logo_url: HTTP_URL_MESSAGE, terms_url: HTTP_URL_MESSAGE }),
}

export const toPartnerFormValues = (partner?: Partner): PartnerFormValues => ({
  name: partner?.name ?? "",
  logo_url: partner?.logo_url ?? "",
  terms_url: partner?.terms_url ?? "",
  support_contact: partner?.support_contact ?? "",
})
