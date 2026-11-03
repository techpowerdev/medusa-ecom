import { MedusaError } from "@medusajs/framework/utils"
import { GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED } from "../errors"

// รับทั้งรูปของ body (values: string | string[]) และรูปที่อ่านผ่าน Query (values: { value }[])
type RuleValue = string | { value?: string | null } | null | undefined
export type ScopeRule = {
  attribute?: string | null
  operator?: string | null
  values?: RuleValue | RuleValue[] | null
}

const valuesOf = (values: ScopeRule["values"]): unknown[] =>
  (Array.isArray(values) ? values : values === undefined || values === null ? [] : [values]).map((v) =>
    v !== null && typeof v === "object" ? v.value : v
  )

/**
 * spec 04 กฎข้อ 30: 1 แคมเปญ group buy = 1 สินค้า — target_rules ต้องมี rule เดียวคือ
 * `items.product.id` `in` [ค่าเดียว] (ห้าม scope ระดับ variant หรือ attribute อื่นของ items) → คืน product id, ไม่ใช่ → null
 */
export function singleProductIdOf(rules: ScopeRule[] | null | undefined): string | null {
  if (!rules || rules.length !== 1) {
    return null
  }
  const [rule] = rules
  if (rule.attribute !== "items.product.id" || rule.operator !== "in") {
    return null
  }
  const values = valuesOf(rule.values)
  return values.length === 1 && typeof values[0] === "string" && values[0] !== "" ? values[0] : null
}

export const SINGLE_PRODUCT_MESSAGE = `${GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED}: a group buy campaign must target exactly one product (application_method.target_rules = [{ attribute: "items.product.id", operator: "in", values: [<product_id>] }])`

// กฎข้อ 30a–b: สร้างแคมเปญ = INVALID_DATA; draft → active และสร้างกลุ่ม = NOT_ALLOWED (400 ทั้งคู่)
export function assertSingleProductScope(
  rules: ScopeRule[] | null | undefined,
  type: typeof MedusaError.Types.INVALID_DATA | typeof MedusaError.Types.NOT_ALLOWED
): void {
  if (singleProductIdOf(rules) === null) {
    throw new MedusaError(type, SINGLE_PRODUCT_MESSAGE, GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED)
  }
}
