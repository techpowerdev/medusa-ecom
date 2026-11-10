import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { type CartLineLike, campaignUnitsInCart, flashSaleLockKey } from "../../lib/flash-sale-units"
import { FLASH_SALE_MODULE } from "../../modules/flash_sale"
import type FlashSaleModuleService from "../../modules/flash_sale/service"

// FS-3 (spec 03 "Workflows / hooks" ข้อ 3): check + จองสิทธิ์ flash ตอน complete cart
// ลงทะเบียนใน handler รวม `complete-cart-validate.ts` (กฎข้อ 8)

export type FlashSaleCartLike = {
  id: string
  customer_id?: string | null
  customer?: { id?: string | null } | null
  items?: CartLineLike[] | null
}

export type FlashSaleReservationRef = { cart_id: string }

/** OPS-18: prefix ของบรรทัด log เวลา lock — `tools/load/lock-timing.js` อ่านบรรทัดนี้ */
export const LOCK_TIMING_MARKER = "flash_sale_lock_timing"

/** จองสิทธิ์ flash ของ cart; คืน ref สำหรับ compensation เมื่อมีการจอง (ไม่มี flash campaign → undefined) */
export async function reserveFlashSaleForCart(
  container: MedusaContainer,
  cart: FlashSaleCartLike
): Promise<FlashSaleReservationRef | undefined> {
  const items = cart.items ?? []
  const promotionIds = [
    ...new Set(
      items.flatMap((i) => (i?.adjustments ?? []).map((a) => a?.promotion_id)).filter((id): id is string => !!id)
    ),
  ]
  if (!promotionIds.length) {
    return
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: promotions } = await query.graph({
    entity: "promotion",
    fields: ["id", "campaign_id"],
    filters: { id: promotionIds },
  })
  const units = campaignUnitsInCart(
    items,
    Object.fromEntries(promotions.map((p) => [p.id, p.campaign_id]))
  )
  if (!units.length) {
    return
  }

  // campaign ที่ไม่มี FlashSaleConfig ไม่ใช่ flash sale → ไม่ตรวจไม่จอง (กฎข้อ 9)
  const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
  const configs = await flashSale.listFlashSaleConfigs(
    { campaign_id: units.map((u) => u.campaign_id) },
    { select: ["campaign_id"] }
  )
  const flashCampaigns = new Set(configs.map((c) => c.campaign_id))
  const campaigns = units.filter((u) => flashCampaigns.has(u.campaign_id))
  if (!campaigns.length) {
    return
  }

  const customerId = cart.customer?.id ?? cart.customer_id
  if (!customerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Flash sale checkout requires a signed-in customer"
    )
  }

  // lock ทุก campaign เรียงตาม campaign_id (campaignUnitsInCart เรียงให้แล้ว) กัน deadlock
  const locking = container.resolve(Modules.LOCKING)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  // OPS-18 (spec 07 AC-29): วัดเวลารอ lock และเวลาภายใน locking.execute — log เฉพาะเมื่อเปิด LOG_LEVEL=debug (load run)
  const requestedAt = Date.now()
  let acquiredAt: number | null = null
  let releasedAt: number | null = null
  let outcome = "ok"
  try {
    await locking.execute(
      campaigns.map((c) => flashSaleLockKey(c.campaign_id, customerId)),
      async () => {
        acquiredAt = Date.now()
        try {
          return await flashSale.reserveForCart({ cart_id: cart.id, customer_id: customerId, campaigns })
        } finally {
          releasedAt = Date.now()
        }
      }
    )
  } catch (e) {
    outcome = (e as { code?: string })?.code || (acquiredAt === null ? "LOCK_ERROR" : "ERROR")
    throw e
  } finally {
    if (logger.shouldLog("debug")) {
      logger.debug(
        `${LOCK_TIMING_MARKER} ${JSON.stringify({
          cart_id: cart.id,
          requested_at: requestedAt,
          acquired_at: acquiredAt,
          released_at: releasedAt,
          wait_ms: (acquiredAt ?? Date.now()) - requestedAt,
          hold_ms: acquiredAt === null || releasedAt === null ? null : releasedAt - acquiredAt,
          outcome,
        })}`
      )
    }
  }

  return { cart_id: cart.id }
}

/** compensation: คืนสิทธิ์ที่จองไว้ของ cart (idempotent) */
export async function releaseFlashSaleForCart(
  container: MedusaContainer,
  ref: FlashSaleReservationRef
): Promise<void> {
  const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
  await flashSale.releaseCartReservations(ref.cart_id)
}
