import { getProductPrice } from "@lib/util/get-product-price"
import { groupDiscountValue, groupSharePath } from "@lib/util/group-page"
import { canCreateTeam, firstPool, groupDiscountedAmount, poolProgress, type ActiveGroupBuyCampaign } from "@lib/util/home-campaigns"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import Link from "next/link"
import Countdown from "@modules/common/components/countdown"
import Thumbnail from "@modules/products/components/thumbnail"
import CreateTeamButton from "./create-team-button"

type Props = {
  campaign: ActiveGroupBuyCampaign
  /** สินค้าเดียวของ `product_id` (กฎข้อ 30) — null เมื่อไม่ขายใน region นี้ */
  product: HttpTypes.StoreProduct | null
  countryCode: string
  now: number
}

/** GB-7c (spec 04 กฎข้อ 29a, 29g, AC-48): การ์ดแคมเปญ group buy — สินค้า ราคาก่อน/หลังส่วนลด pool ที่เปิดอยู่ และปุ่มสร้างทีม */
export default function GroupCampaignCard({ campaign, product, countryCode, now }: Props) {
  const discount = groupDiscountValue(campaign.discount)
  const price = product ? getProductPrice({ product }).cheapestPrice : null
  const after = price ? groupDiscountedAmount(price.calculated_price_number, price.currency_code, campaign.discount) : null
  const pool = firstPool(campaign)
  const progress = pool ? poolProgress(pool, campaign) : null

  return (
    <li
      className="flex flex-col gap-y-3 rounded-rounded border border-border p-4"
      data-testid="group-campaign-card"
      data-campaign-id={campaign.id}
    >
      <span className="text-xs leading-5 font-normal text-muted-foreground">ซื้อกลุ่ม</span>
      <h3 className="text-sm leading-6 font-semibold break-words">{campaign.name}</h3>
      {product && (
        <div className="flex items-center gap-x-3">
          <div className="w-20 shrink-0" data-testid="group-campaign-thumbnail">
            <Thumbnail thumbnail={product.thumbnail} images={product.images} size="square" alt={product.title} />
          </div>
          <div className="flex min-w-0 flex-col gap-y-1">
            {/* testid เดียวกับชื่อสินค้าบนการ์ดอื่น — ข้อมูลจาก backend (store-content.spec ไม่นับเป็นข้อความของ storefront) */}
            <span className="text-xs leading-5 font-normal break-words" data-testid="product-title">
              {product.title}
            </span>
            {price && (
              <p className="flex flex-wrap items-baseline gap-x-2" data-testid="group-campaign-price">
                {after != null ? (
                  <>
                    <s className="text-xs leading-5 font-normal text-muted-foreground">{price.calculated_price}</s>
                    <span className="text-sm leading-6 font-semibold text-primary">
                      {convertToLocale({ amount: after, currency_code: price.currency_code })}
                    </span>
                  </>
                ) : (
                  <span className="text-sm leading-6 font-semibold">{price.calculated_price}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}
      {discount && <p className="text-xs leading-5 font-normal text-primary">ลด {discount} เมื่อกลุ่มครบเป้าหมาย</p>}
      <Countdown endsAt={campaign.ends_at} now={now} testId="group-campaign-countdown" expiredLabel="หมดเวลาแล้ว" />
      {pool && progress && (
        <div className="flex flex-col gap-y-2">
          <span className="text-xs leading-5 font-normal" data-testid="group-campaign-progress">
            กลุ่มเปิด{" "}
            <span className="tabular-nums">
              {progress.current} / {progress.target}
            </span>{" "}
            {progress.unit}
          </span>
          <Link
            href={groupSharePath(countryCode, pool.join_token)}
            className="text-xs leading-5 font-normal text-primary underline underline-offset-4"
            data-testid="group-pool-link"
          >
            เข้าร่วมกลุ่มเปิด
          </Link>
        </div>
      )}
      {canCreateTeam(campaign) && <CreateTeamButton campaignId={campaign.id} countryCode={countryCode} />}
    </li>
  )
}
