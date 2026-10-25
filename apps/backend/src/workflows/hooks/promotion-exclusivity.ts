import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  PROMOTION_NOT_COMBINABLE,
  type PromoCodeAction,
  type PromotionLike,
  exclusivityPromotionContext,
  hasCompletionConflict,
  introducesGroupBuyConflict,
  resolvePromoCodes,
} from "../../lib/promotion-exclusivity"

// PROMO-1 (spec 03 กฎข้อ 6, spec 04 กฎข้อ 7, ADR-009)
// hook เหล่านี้ไม่เขียนข้อมูล (เติม context / ปฏิเสธเท่านั้น) จึงไม่มี compensation

type WithAdjustments = { adjustments?: ({ code?: string | null } | null)[] | null } | null
export type CartLike = {
  items?: WithAdjustments[] | null
  shipping_methods?: WithAdjustments[] | null
  promotions?: ({ code?: string | null } | null)[] | null
}

const present = (codes: (string | null | undefined)[]) =>
  [...new Set(codes.filter((c): c is string => !!c))]

// ตรงกับที่ Medusa ใช้เป็น "code เดิม" ใน getPromotionCodesToApply
const adjustmentCodes = (cart: CartLike) =>
  present(
    [...(cart.items ?? []), ...(cart.shipping_methods ?? [])].flatMap((line) =>
      (line?.adjustments ?? []).map((a) => a?.code)
    )
  )

const cartCodes = (cart: CartLike) =>
  present([...adjustmentCodes(cart), ...(cart.promotions ?? []).map((p) => p?.code)])

const listPromotions = async (
  container: MedusaContainer,
  codes: string[],
  fields: string[]
): Promise<PromotionLike[]> => {
  if (!codes.length) {
    return []
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "promotion", fields, filters: { code: codes } })
  return data as PromotionLike[]
}

const manualCodes = async (container: MedusaContainer, codes: string[]) =>
  (await listPromotions(container, codes, ["code", "is_automatic"]))
    .filter((p) => p.is_automatic !== true)
    .map((p) => p.code as string)

const notCombinable = () =>
  new MedusaError(
    MedusaError.Types.CONFLICT,
    "This promotion can't be combined with the promotions already on the cart",
    PROMOTION_NOT_COMBINABLE
  )

// ชุด code ผลลัพธ์มี code (is_automatic=false) → "true" ให้ Medusa ข้าม exclusive automatic promotion เอง
updateCartPromotionsWorkflow.hooks.setPromotionContext(
  async ({ cart, action, promo_codes }, { container }) => {
    const resulting = resolvePromoCodes({
      existing: adjustmentCodes(cart as CartLike),
      input: promo_codes ?? [],
      action: action as PromoCodeAction,
    })
    const codes = await manualCodes(container, resulting)
    return new StepResponse(exclusivityPromotionContext(codes.length > 0))
  }
)

// `GB-*` ห้ามอยู่กับ code อื่น — ไม่ปฏิเสธ flash + code (code ชนะผ่าน context ข้างบน)
updateCartPromotionsWorkflow.hooks.validate(async ({ input, cart }, { container }) => {
  const resulting = resolvePromoCodes({
    existing: adjustmentCodes(cart as CartLike),
    input: input.promo_codes ?? [],
    action: input.action as PromoCodeAction,
  })
  const resultingManualCodes = await manualCodes(container, resulting)

  if (introducesGroupBuyConflict({ existing: cartCodes(cart as CartLike), resultingManualCodes })) {
    throw notCombinable()
  }
})

// ด่านสำรอง: cart ที่หลุดมาถึง checkout พร้อมชุด promotion ที่ห้ามซ้อน
// ลงทะเบียนใน handler รวม `complete-cart-validate.ts` (spec 03 กฎข้อ 8 — hook หนึ่งตัวมี handler ได้ตัวเดียว)
export async function assertCompletionCombinable(container: MedusaContainer, cart: CartLike) {
  const promotions = await listPromotions(container, cartCodes(cart), [
    "code",
    "is_automatic",
    "rules.attribute",
    "rules.operator",
    "rules.values.value",
  ])

  if (hasCompletionConflict(promotions)) {
    throw notCombinable()
  }
}
