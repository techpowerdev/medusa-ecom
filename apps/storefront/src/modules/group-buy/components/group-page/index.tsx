import { getProductPrice } from "@lib/util/get-product-price"
import {
  GROUP_STATUS_LABEL,
  groupDiscountValue,
  groupJoinable,
  groupProgress,
  type PublicGroupBuyGroupView,
} from "@lib/util/group-page"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ShareLinkButton from "@modules/common/components/share-link-button"
import Thumbnail from "@modules/products/components/thumbnail"
import GroupCountdown from "./countdown"
import GroupJoin from "./group-join"

type Props = {
  view: PublicGroupBuyGroupView
  /** สินค้าเดียวของ `product_id` (กฎข้อ 30) — null เมื่อแคมเปญไม่มีสินค้าที่ใช้ได้หรือไม่ขายใน region นี้ */
  product: HttpTypes.StoreProduct | null
  shareUrl: string
  /** ที่อยู่ที่บันทึกไว้ของลูกค้า; null = ยังไม่ login */
  addresses: HttpTypes.StoreCustomerAddress[] | null
  /** เวลาของ request (server component render ครั้งเดียว) */
  now: number
}

// GB-7a1 (spec 04 กฎข้อ 29b, AC-16a): หน้ากลุ่ม — GB-7a2 เพิ่มการเลือก variant + join (กฎข้อ 29c–f, 31)
export default function GroupPage({ view: { group, campaign }, product, shareUrl, addresses, now }: Props) {
  const progress = groupProgress(group, campaign)
  const discount = groupDiscountValue(campaign.discount)
  const open = group.status === "open"
  // กฎข้อ 29e: ปุ่ม join และลิงก์แชร์ซ่อนเมื่อกลุ่มไม่ open หรือเลย ends_at แล้ว (job อาจยังไม่ตัดสิน)
  const joinable = groupJoinable(group, now)
  const price = product ? getProductPrice({ product }).cheapestPrice : null

  return (
    <div className="content-container flex flex-col gap-y-6 py-8 small:py-12" data-testid="group-page">
      <header className="flex flex-col gap-y-2">
        <span className="text-small-regular text-ui-fg-subtle">
          {group.kind === "team" ? "ซื้อกลุ่มแบบทีม" : "ซื้อกลุ่มแบบกลุ่มเปิด"}
        </span>
        <h1 className="text-2xl-semi break-words">{campaign.name}</h1>
        {discount && (
          <p className="text-large-semi text-ui-fg-interactive" data-testid="group-discount">
            รับส่วนลด {discount} เมื่อกลุ่มครบเป้าหมาย
          </p>
        )}
      </header>

      {product && (
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="flex items-center gap-x-4"
          data-testid="group-product"
        >
          <div className="w-24 shrink-0">
            <Thumbnail thumbnail={product.thumbnail} images={product.images} size="square" />
          </div>
          <div className="flex min-w-0 flex-col gap-y-1">
            <span className="text-base-semi break-words">{product.title}</span>
            {price && (
              <span className="text-small-regular text-ui-fg-subtle">ราคาปกติเริ่มต้น {price.calculated_price}</span>
            )}
          </div>
        </LocalizedClientLink>
      )}

      <section className="flex flex-col gap-y-3 rounded-rounded border border-ui-border-base p-4">
        <p className="text-base-semi" data-testid="group-status" data-status={group.status}>
          {GROUP_STATUS_LABEL[group.status]}
        </p>
        <div data-testid="group-progress" className="flex flex-col gap-y-2">
          <span className="text-base-regular">
            ความคืบหน้า{" "}
            <span className="tabular-nums">
              {progress.current} / {progress.target}
            </span>{" "}
            {progress.unit}
          </span>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ui-bg-subtle"
            role="progressbar"
            aria-label="ความคืบหน้าของกลุ่ม"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <div className="h-full bg-ui-fg-interactive" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
        <p className="text-base-regular" data-testid="group-member-count">
          สมาชิก <span className="tabular-nums">{group.progress_people}</span> คน
        </p>
        {open && <GroupCountdown endsAt={group.ends_at} now={now} />}
      </section>

      {joinable && product && (
        <GroupJoin
          token={group.join_token}
          product={product}
          addresses={addresses}
          maxUnitsPerPerson={campaign.max_units_per_person}
        />
      )}

      {/* ลิงก์แชร์ `/g/<token>` + ปุ่มคัดลอก (กฎข้อ 29b, 29g) */}
      {joinable && (
        <section className="flex flex-col gap-y-2">
          <span className="text-small-regular text-ui-fg-subtle">แชร์ลิงก์นี้ให้เพื่อนเข้าร่วมกลุ่ม</span>
          <a href={shareUrl} className="break-all text-ui-fg-interactive underline" data-testid="group-share-link">
            {shareUrl}
          </a>
          <div className="self-start">
            <ShareLinkButton
              url={shareUrl}
              label="คัดลอกลิงก์"
              buttonTestId="group-share-copy"
              statusTestId="group-share-copy-status"
            />
          </div>
        </section>
      )}
    </div>
  )
}
