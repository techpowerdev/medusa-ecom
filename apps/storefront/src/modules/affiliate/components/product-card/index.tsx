import type { PortalProduct } from "@lib/data/affiliate-portal"
import { cardPrice, countdownText, estimateCommission, PortalTab, priceVaries } from "@lib/util/affiliate-portal"
import { formatDate } from "@lib/util/date"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"

import ShareButton from "../share-button"

// spec 05 Storefront + กฎ 29: การ์ดเดียวต่อสินค้า อัตราของโปรแกรมที่เลือก (rate_varies → "สูงสุด X%")
// AF-8c กฎ 35b: rate_varies ไม่แสดงยอดประมาณการ — API ไม่ส่งอัตราต่อ variant ตัวเลขอาจไม่ตรง variant ใดเลย
export default function AffiliateProductCard({ item, tab }: { item: PortalProduct; tab: PortalTab }) {
  const { product, program, rate_varies, share_url } = item
  const price = cardPrice(product.variants)

  return (
    <li
      className="flex flex-col gap-y-2 border border-ui-border-base rounded-rounded p-4"
      data-testid="affiliate-product-card"
      data-handle={product.handle}
    >
      <Thumbnail thumbnail={product.thumbnail} size="square" alt={product.title} />
      <p className="text-base-semi">{product.title}</p>
      {price && <p className="text-ui-fg-subtle">{convertToLocale(price)}</p>}
      <p className="text-large-semi" data-testid="affiliate-rate">
        {rate_varies && <span data-testid="affiliate-rate-varies">สูงสุด </span>}
        {program.commission_value}%
      </p>
      {price && !rate_varies && (
        <p className="text-small-regular" data-testid="affiliate-estimate">
          {priceVaries(product.variants) ? "ได้ประมาณตั้งแต่" : "ได้ประมาณ"}{" "}
          {convertToLocale({
            amount: estimateCommission(price.amount, program.commission_value),
            currency_code: price.currency_code,
          })}{" "}
          ต่อชิ้น
        </p>
      )}
      <p className="text-small-regular" data-testid="affiliate-program-name">
        {program.name}
      </p>
      <p className="text-small-regular text-ui-fg-subtle" data-testid="affiliate-program-dates">
        {formatDate(program.starts_at)} – {formatDate(program.ends_at)}
      </p>
      {tab === "upcoming" && (
        <p className="text-small-regular" data-testid="affiliate-countdown">
          {countdownText(program.starts_at)}
        </p>
      )}
      <ShareButton url={share_url} title={product.title} />
    </li>
  )
}
