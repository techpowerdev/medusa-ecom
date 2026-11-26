import { castNumber, optionalFloat, optionalInt } from "@medusajs/dashboard/lib"
import { z } from "zod"
import { t } from "../i18n/t"
import { fieldErrorMap, isBlank } from "./form-validation"

// ADM-3 (spec 08 AC-6, กฎ 8): ฟอร์ม Create pool บน widget "Voucher pool" ของหน้า variant (EV-6, spec 02)

const DEFAULT_LOW_STOCK_THRESHOLD = 20

export const poolFormSchema = z.object({
  // spec 10 กฎ 4d (AI18N-3): ข้อความแบบ lazy ของ zod — เรียก t ตอน parse (ภาษาปัจจุบัน) ไม่ใช่ตอนโหลด module
  partner_id: z.string().min(1, { error: () => t("ecom-evoucher", "pool.errors.partner") }),
  name: z.string().trim().min(1, { error: () => t("ecom-evoucher", "form.errors.nameRequired") }),
  how_to_use: z.string().trim().min(1, { error: () => t("ecom-evoucher", "pool.errors.howToUse") }),
  face_value: optionalFloat.transform((value) => (isBlank(value) ? null : castNumber(value))),
  validity_note: z
    .string()
    .trim()
    .transform((value) => value || null),
  low_stock_threshold: optionalInt.transform((value) =>
    isBlank(value) ? DEFAULT_LOW_STOCK_THRESHOLD : castNumber(value)
  ),
})

export type PoolFormValues = z.input<typeof poolFormSchema>
/** body ของ createPool ยกเว้น variant_id (มาจากหน้า variant) */
export type PoolFormBody = z.output<typeof poolFormSchema>

export const POOL_FORM_DEFAULTS = {
  partner_id: "",
  name: "",
  how_to_use: "",
  face_value: "",
  validity_note: "",
  low_stock_threshold: String(DEFAULT_LOW_STOCK_THRESHOLD),
} satisfies PoolFormValues

export const POOL_PARSE_OPTIONS = {
  error: fieldErrorMap({
    face_value: () => t("ecom-evoucher", "pool.errors.faceValue"),
    low_stock_threshold: () => t("ecom-evoucher", "pool.errors.lowStockThreshold"),
  }),
}
