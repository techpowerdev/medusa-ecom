import type { CreatePromotionDTO, CreatePromotionRuleDTO } from "@medusajs/framework/types"
import { randomCode } from "./template-code"

export const GROUP_CODE_PREFIX = "GB-"

type TemplateRule = { attribute: string; operator: string; values: { value: string }[] }

// รูปของ promotion ต้นแบบที่อ่านผ่าน Query (link template, ADR-011)
export type TemplatePromotion = {
  id: string
  code: string
  status: string
  is_automatic: boolean
  is_tax_inclusive: boolean
  campaign_id: string
  application_method: {
    type: "fixed" | "percentage"
    target_type: "items" | "shipping_methods" | "order"
    allocation: "each" | "across" | "once" | null
    value: number
    currency_code: string | null
    max_quantity: number | null
    apply_to_quantity?: number | null
    buy_rules_min_quantity?: number | null
    target_rules: TemplateRule[]
  }
  rules: TemplateRule[]
}

// spec 04 createGroupWorkflow ขั้น 3: join_token สุ่ม URL-safe (unique index ที่ group_buy_group.join_token)
export const generateJoinToken = (): string => randomCode()

const cloneRules = (rules: TemplateRule[]): CreatePromotionRuleDTO[] =>
  rules.map(({ attribute, operator, values }) => ({
    attribute,
    operator: operator as CreatePromotionRuleDTO["operator"],
    values: values.map((v) => v.value),
  }))

// ADR-011 ข้อ 2: clone ต้นแบบเป็น GB-<token> — ระบุ status "active" เสมอ (ค่าเริ่มต้นของ Medusa คือ draft)
// ต้นแบบสร้างเป็น type standard เสมอ (GB-2a) จึงไม่มี buy_rules ให้คัดลอก
export function buildGroupPromotionInput(
  template: TemplatePromotion,
  token: string
): CreatePromotionDTO {
  const { type, target_type, allocation, value, currency_code, max_quantity, target_rules } =
    template.application_method
  return {
    code: GROUP_CODE_PREFIX + token,
    type: "standard",
    status: "active",
    is_automatic: false,
    is_tax_inclusive: template.is_tax_inclusive,
    campaign_id: template.campaign_id,
    application_method: {
      type,
      target_type,
      ...(allocation ? { allocation } : {}),
      value: Number(value),
      ...(currency_code ? { currency_code } : {}),
      max_quantity,
      target_rules: cloneRules(target_rules ?? []),
    },
    rules: cloneRules(template.rules ?? []),
  }
}
