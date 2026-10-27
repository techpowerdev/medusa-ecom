import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { DEFAULT_REGION_STORE_POLICIES } from "../../../lib/region-store-policies"

// CORE-20b (owner Q-F6 2026-10-27, AC-95): POST /store/returns ของ Medusa 2.22.1 ไม่ตรวจช่วงคืนและ requires_shipping
// → ทุก item ใน body ต้องเป็น line ที่ต้องจัดส่ง (ไม่ใช่ e-voucher) และอยู่ในช่วง return_window_days ของ region ของ order
// นับจาก delivered_at ของ fulfillment ที่มี line นั้น (ไม่มีใช้ shipped_at) — 400 invalid_data พร้อม code ให้ storefront แปลไทย
export const RETURN_ITEM_NOT_SHIPPABLE = "RETURN_ITEM_NOT_SHIPPABLE"
export const RETURN_ITEM_NOT_SHIPPED = "RETURN_ITEM_NOT_SHIPPED"
export const RETURN_WINDOW_EXPIRED = "RETURN_WINDOW_EXPIRED"

const DAY_MS = 24 * 60 * 60 * 1000

type Dateish = Date | string | null | undefined
type ReturnWindowOrder = {
  items?: ({ id: string; requires_shipping?: boolean | null } | null)[] | null
  fulfillments?:
    | ({
        shipped_at?: Dateish
        delivered_at?: Dateish
        canceled_at?: Dateish
        items?: ({ line_item_id?: string | null } | null)[] | null
      } | null)[]
    | null
}

// ค่าแบบเดียวกับที่ storefront อ่าน (ตัวเลข ≥ 0 หรือ string ตัวเลข) ไม่ถูกต้อง/ไม่มี → ค่าเริ่มต้นของ region-store-policies
export function returnWindowDaysOf(metadata: Record<string, unknown> | null | undefined): number {
  const value = metadata?.return_window_days
  const days = typeof value === "string" && value.trim() === "" ? NaN : Number(value)
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_REGION_STORE_POLICIES.return_window_days
}

// กฎข้อ 37: ข้อความคงที่ ไม่ต่อ item.id จาก input
export function storeReturnWindowError(
  itemIds: string[],
  order: ReturnWindowOrder,
  returnWindowDays: number,
  now: Date
): { code: string; message: string } | null {
  for (const itemId of itemIds) {
    const line = order.items?.find((i) => i?.id === itemId)
    if (line?.requires_shipping !== true) {
      return { code: RETURN_ITEM_NOT_SHIPPABLE, message: "Only shipped products of the order can be returned" }
    }
    // วันอ้างอิงล่าสุดของ fulfillment (ไม่ถูกยกเลิก) ที่มี line นี้
    const receivedAt = Math.max(
      ...(order.fulfillments ?? [])
        .filter((f) => f && !f.canceled_at && f.items?.some((fi) => fi?.line_item_id === itemId))
        .map((f) => f!.delivered_at ?? f!.shipped_at)
        .filter((at): at is Date | string => !!at)
        .map((at) => new Date(at).getTime())
    )
    if (!Number.isFinite(receivedAt)) {
      return { code: RETURN_ITEM_NOT_SHIPPED, message: "Items that have not been shipped cannot be returned" }
    }
    if (now.getTime() > receivedAt + returnWindowDays * DAY_MS) {
      return { code: RETURN_WINDOW_EXPIRED, message: "The return window for this order has expired" }
    }
  }
  return null
}

// ต่อท้าย chain: auth + ownership (CORE-13) → override (CORE-16) → option (CORE-17/21) — order มีอยู่และเป็นของลูกค้าแล้ว
// body ที่ items ไม่ใช่ array ปล่อยให้ validator ของ core ตอบ 400 เอง
export async function validateStoreReturnWindow(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const body = (req.body ?? {}) as { order_id?: unknown; items?: unknown }
  if (!Array.isArray(body.items) || typeof body.order_id !== "string") {
    return next()
  }
  const itemIds = body.items.map((i) => String((i as { id?: unknown } | null)?.id))

  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "region_id",
      "items.id",
      "items.requires_shipping",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.items.line_item_id",
    ],
    filters: { id: body.order_id },
  })
  const order = orders[0]
  const { data: regions } = order?.region_id
    ? await query.graph({ entity: "region", fields: ["metadata"], filters: { id: order.region_id } })
    : { data: [] }

  const error = storeReturnWindowError(
    itemIds,
    (order ?? {}) as ReturnWindowOrder,
    returnWindowDaysOf(regions[0]?.metadata),
    new Date()
  )
  if (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error.message, error.code)
  }
  next()
}
