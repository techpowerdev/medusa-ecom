import { castNumber, optionalInt } from "@medusajs/dashboard/lib"
import { z } from "zod"
import { t } from "../i18n/t"
import { fieldErrorMap, isBlank } from "./form-validation"

// ADM-3 (spec 08 AC-6, กฎ 8): ฟอร์มใน drawer ของ widget "Flash sale options" (FS-5, spec 03)

// spec 10 กฎ 4d (AI18N-2): ข้อความเป็น function เรียก t ตอน parse (ไม่เรียกตอนโหลด module)
export const positiveIntMessage = () => t("ecom-group-buy", "flashSale.errors.positiveInt")

// ว่าง = ไม่จำกัด (null); optionalInt อย่างเดียวรับ "0" และไม่แปลง "" เป็น null จึงต่อด้วย refine + transform
export const optionalPositiveInt = optionalInt
  .refine((value) => isBlank(value) || castNumber(value) >= 1, { error: positiveIntMessage })
  .transform((value) => (isBlank(value) ? null : castNumber(value)))

export const flashSaleFormSchema = z.object({
  per_customer_limit: optionalPositiveInt,
  total_cap: optionalPositiveInt,
  show_countdown: z.boolean(),
  show_remaining: z.boolean(),
  banner_text: z.string().transform((value) => (value.trim() === "" ? null : value)),
})

export type FlashSaleFormValues = z.input<typeof flashSaleFormSchema>

export const FLASH_SALE_PARSE_OPTIONS = {
  error: fieldErrorMap({ per_customer_limit: positiveIntMessage, total_cap: positiveIntMessage }),
}

type SavedConfig = {
  per_customer_limit: number | null
  total_cap: number | null
  show_countdown: boolean
  show_remaining: boolean
  banner_text: string | null
}

export const toFlashSaleFormValues = (config: SavedConfig | null): FlashSaleFormValues => ({
  per_customer_limit: config?.per_customer_limit?.toString() ?? "",
  total_cap: config?.total_cap?.toString() ?? "",
  show_countdown: config?.show_countdown ?? false,
  show_remaining: config?.show_remaining ?? false,
  banner_text: config?.banner_text ?? "",
})
