import type { FlashSale } from "@lib/util/flash-sale"
import { hasHomeCampaigns, type ActiveGroupBuyCampaign } from "@lib/util/home-campaigns"
import { HttpTypes } from "@medusajs/types"
import FlashCampaignCard from "./flash-campaign-card"
import GroupCampaignCard from "./group-campaign-card"

type Props = {
  flashSales: FlashSale[]
  groupCampaigns: ActiveGroupBuyCampaign[]
  products: HttpTypes.StoreProduct[]
  countryCode: string
  now: number
}

// GB-7c (spec 04 กฎข้อ 29a, AC-48): แคมเปญ flash + group buy ที่ active บนหน้าแรก (ไม่มีหน้า /group-buy แยก — Q15)
// ข้อมูลใช้ cache ของหน้าแรก (ADR-017); ไม่มีแคมเปญเลย → ไม่แสดงส่วนนี้
export default function HomeCampaigns({ flashSales, groupCampaigns, products, countryCode, now }: Props) {
  if (!hasHomeCampaigns(flashSales, groupCampaigns)) return null
  const byId = new Map(products.map((p) => [p.id, p]))

  return (
    <section className="content-container py-12" data-testid="home-campaigns">
      <h2 className="txt-xlarge mb-6">แคมเปญที่กำลังจัด</h2>
      <ul className="grid grid-cols-1 gap-4 small:grid-cols-2 medium:grid-cols-3">
        {flashSales.map((sale) => (
          <FlashCampaignCard key={sale.id} sale={sale} now={now} />
        ))}
        {groupCampaigns.map((campaign) => (
          <GroupCampaignCard
            key={campaign.id}
            campaign={campaign}
            product={(campaign.product_id && byId.get(campaign.product_id)) || null}
            countryCode={countryCode}
            now={now}
          />
        ))}
      </ul>
    </section>
  )
}
