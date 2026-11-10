// FS-3 (spec 03 กฎข้อ 9): units ต่อ flash campaign ใน cart — pure, ไม่คำนวณส่วนลดเอง (ADR-003)

type QuantityLike = number | string | { numeric?: number } | null | undefined

export type CartLineLike = {
  quantity?: QuantityLike
  adjustments?: ({ promotion_id?: string | null } | null)[] | null
} | null

export type CampaignUnits = { campaign_id: string; units: number }

const toNumber = (q: QuantityLike) =>
  typeof q === "object" && q !== null ? Number(q.numeric ?? 0) : Number(q ?? 0)

/**
 * ผลรวม `quantity` เต็มของทุก line ที่มี adjustment จาก promotion ของ campaign (ไม่ใช่ `min(quantity, max_quantity)`)
 * line เดียวนับครั้งเดียวต่อ campaign แม้มีหลาย adjustment ของ campaign เดียวกัน; เรียงตาม `campaign_id`
 */
export function campaignUnitsInCart(
  lines: CartLineLike[],
  campaignByPromotionId: Record<string, string | null | undefined>
): CampaignUnits[] {
  const units = new Map<string, number>()

  for (const line of lines) {
    const campaigns = new Set(
      (line?.adjustments ?? [])
        .map((a) => (a?.promotion_id ? campaignByPromotionId[a.promotion_id] : undefined))
        .filter((c): c is string => !!c)
    )
    for (const campaign of campaigns) {
      units.set(campaign, (units.get(campaign) ?? 0) + toNumber(line?.quantity))
    }
  }

  return [...units.entries()]
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([campaign_id, n]) => ({ campaign_id, units: n }))
}

/** lock ต่อ (campaign_id, customer_id) ตาม spec 03 — namespace `flash_sale:*` */
export function flashSaleLockKey(campaignId: string, customerId: string): string {
  return `flash_sale:customer:${campaignId}:${customerId}`
}
