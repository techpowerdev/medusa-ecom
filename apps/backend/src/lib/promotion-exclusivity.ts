// PROMO-1 (spec 03 กฎข้อ 6, spec 04 กฎข้อ 7, ADR-009)
// Medusa เป็นผู้ตัดสินว่าจะใช้ promotion ไหนเสมอ เราแค่ป้อน context หนึ่ง attribute และปฏิเสธชุด code ที่ห้ามซ้อน

export const EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE = "exclusivity.code_applied"
export const PROMOTION_NOT_COMBINABLE = "PROMOTION_NOT_COMBINABLE"
export const GROUP_BUY_CODE_PREFIX = "GB-"

export type PromoCodeAction = "add" | "remove" | "replace"

type RuleValueLike = string | { value?: string | null } | null
type PromotionRuleLike = {
  attribute?: string | null
  operator?: string | null
  values?: RuleValueLike[] | null
} | null

export type PromotionLike = {
  code?: string | null
  is_automatic?: boolean | null
  rules?: PromotionRuleLike[] | null
}

/** rule ที่ทำให้ automatic promotion เป็น "exclusive" — Medusa จะข้ามมันเมื่อ cart มี code */
export function exclusiveAutomaticRule() {
  return {
    attribute: EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE,
    operator: "ne" as const,
    values: ["true"],
  }
}

const ruleValue = (v: RuleValueLike) => (typeof v === "string" ? v : v?.value)

export function isExclusiveAutomatic(promotion: PromotionLike): boolean {
  if (promotion.is_automatic !== true) {
    return false
  }
  return (promotion.rules ?? []).some(
    (rule) =>
      rule?.attribute === EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE &&
      rule.operator === "ne" &&
      (rule.values ?? []).some((v) => ruleValue(v) === "true")
  )
}

export function isGroupBuyCode(code: string): boolean {
  return code.startsWith(GROUP_BUY_CODE_PREFIX)
}

/** ชุด code ผลลัพธ์ของ updateCartPromotionsWorkflow ตาม action (ตรงกับ getPromotionCodesToApply ของ Medusa) */
export function resolvePromoCodes({
  existing,
  input,
  action = "add",
}: {
  existing: string[]
  input: string[]
  action?: PromoCodeAction
}): string[] {
  if (action === "replace") {
    return [...new Set(input)]
  }
  if (action === "remove") {
    const removed = new Set(input)
    return [...new Set(existing)].filter((code) => !removed.has(code))
  }
  return [...new Set([...existing, ...input])]
}

/** ค่าที่คืนจาก hook setPromotionContext — ต้องตั้งเสมอ เพราะ Medusa ตัด promotion ที่ rule อ้าง attribute ที่ไม่มีใน context */
export function exclusivityPromotionContext(codeApplied: boolean) {
  return { exclusivity: { code_applied: codeApplied ? "true" : "false" } }
}

/**
 * spec 04 กฎข้อ 7: `GB-*` ห้ามอยู่กับ code อื่น (`is_automatic=false`)
 * ปฏิเสธเฉพาะเมื่อการเรียกครั้งนี้เพิ่ม code ใหม่ — refresh (ไม่มี code ใหม่) ต้องไม่ error
 */
export function introducesGroupBuyConflict({
  existing,
  resultingManualCodes,
}: {
  existing: string[]
  resultingManualCodes: string[]
}): boolean {
  const manual = [...new Set(resultingManualCodes)]
  const before = new Set(existing)
  const addsNewCode = manual.some((code) => !before.has(code))
  return addsNewCode && manual.length > 1 && manual.some(isGroupBuyCode)
}

/** ด่านสำรองตอน complete cart: exclusive automatic + code ใดๆ หรือ `GB-*` + code อื่น */
export function hasCompletionConflict(promotions: PromotionLike[]): boolean {
  const manualCodes = promotions
    .filter((p) => p.is_automatic !== true)
    .map((p) => p.code ?? "")
  const hasExclusive = promotions.some(isExclusiveAutomatic)

  if (hasExclusive && manualCodes.length > 0) {
    return true
  }
  return manualCodes.length > 1 && manualCodes.some(isGroupBuyCode)
}
