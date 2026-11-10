import { isExclusiveAutomatic, type PromotionLike } from "./promotion-exclusivity"

export type CampaignPromotion = PromotionLike & { id: string }

// FS-5 (spec 03 กฎข้อ 7): ทุก automatic promotion ของ flash campaign ต้องมี exclusivity rule
// ใช้ทั้ง workflow บันทึก config (หาตัวที่ต้องใส่ rule) และ GET config (widget เตือน)
export function promotionsMissingExclusivityRule(
  promotions: (CampaignPromotion | null | undefined)[] | null | undefined
): CampaignPromotion[] {
  return (promotions ?? []).filter(
    (promotion): promotion is CampaignPromotion =>
      promotion?.is_automatic === true && !isExclusiveAutomatic(promotion)
  )
}
