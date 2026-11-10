import { getActiveFlashSales } from "@lib/data/flash-sales"
import { hasFlashCodeConflict } from "@lib/util/flash-sale"
import { HttpTypes } from "@medusajs/types"

/**
 * FS-6 (spec 03 AC-8 g, ADR-009 "code ชนะ"): cart ที่มี promotion code และสินค้าในแคมเปญ flash จะไม่ได้ส่วนลด flash
 * (Medusa ข้ามให้เองตามกฎข้อ 6b) — แจ้งลูกค้าให้รู้ว่าเลือกได้อย่างใดอย่างหนึ่ง
 */
export default async function FlashCodeNotice({
  cart,
}: {
  cart: HttpTypes.StoreCart
}) {
  if (
    !cart.region_id ||
    !cart.promotions?.some((p) => p.is_automatic === false)
  ) {
    return null
  }
  const variantIds = (cart.items ?? []).flatMap((i) =>
    i.variant_id ? [i.variant_id] : []
  )
  const data = await getActiveFlashSales(cart.region_id, variantIds)

  if (!hasFlashCodeConflict(cart.promotions, data)) {
    return null
  }

  return (
    <p
      className="txt-medium rounded-rounded bg-ui-bg-subtle p-3 text-ui-fg-subtle"
      data-testid="flash-not-combinable"
    >
      ราคาแฟลชเซลใช้ร่วมกับโค้ดส่วนลดไม่ได้ — ลบโค้ดออกเพื่อรับราคาแฟลชเซล
    </p>
  )
}
