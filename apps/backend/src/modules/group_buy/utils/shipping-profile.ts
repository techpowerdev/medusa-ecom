import { MedusaError } from "@medusajs/framework/utils"
import { GB_SHIPPING_PROFILE_NOT_COVERED } from "../errors"

export type ShippingCart = {
  items?:
    | ({
        requires_shipping?: boolean | null
        variant?: { product?: { shipping_profile?: { id?: string | null } | null } | null } | null
      } | null)[]
    | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}
export type ShippingOptionProfile = { id: string; shipping_profile_id?: string | null }

export const SHIPPING_PROFILE_NOT_COVERED_MESSAGE = `${GB_SHIPPING_PROFILE_NOT_COVERED}: the cart's shipping methods don't cover the shipping profiles of its items`

/**
 * spec 04 กฎข้อ 35: กฎเทียบเดียวกับ `validateShippingStep` ของ Medusa 2.22.1 — profile ของทุก line ที่ `requires_shipping`
 * ต้องอยู่ในชุด profile ของ option ของ shipping method; line ที่สินค้าไม่มี profile ถือว่าไม่ครอบ (`available` ไม่มีค่าว่าง)
 * ต่างจาก Medusa: cart ที่ไม่มี shipping method เลยไม่ตรวจ (กฎข้อ 35c, Q22)
 */
export function assertShippingProfilesCovered(cart: ShippingCart, shippingOptions: ShippingOptionProfile[]): void {
  const methods = (cart.shipping_methods ?? []).filter((m) => !!m)
  if (!methods.length) {
    return
  }
  const profileOf = new Map(shippingOptions.map((o) => [o.id, o.shipping_profile_id]))
  const available = new Set(methods.map((m) => profileOf.get(m.shipping_option_id ?? "")).filter((p) => !!p))
  const missing = (cart.items ?? [])
    .filter((i) => i?.requires_shipping)
    .some((i) => {
      const profile = i?.variant?.product?.shipping_profile?.id
      return !available.has(profile)
    })
  if (missing) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      SHIPPING_PROFILE_NOT_COVERED_MESSAGE,
      GB_SHIPPING_PROFILE_NOT_COVERED
    )
  }
}
