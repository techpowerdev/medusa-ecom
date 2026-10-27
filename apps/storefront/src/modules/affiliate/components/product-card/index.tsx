import type { PortalProduct } from "@lib/data/affiliate-portal"
import { cardPrice, daysUntil, estimateCommission, PortalTab } from "@lib/util/affiliate-portal"
import { formatDate } from "@lib/util/date"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"

import ShareButton from "../share-button"

// spec 05 Storefront + กฎ 29: การ์ดเดียวต่อสินค้า อัตราของโปรแกรมที่เลือก (rate_varies → "สูงสุด X%")
export default function AffiliateProductCard({ item, tab }: { item: PortalProduct; tab: PortalTab }) {
  const { product, program, rate_varies, share_url } = item
  const price = cardPrice(product.variants)
  const days = daysUntil(program.starts_at)

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
      {price && (
        <p className="text-small-regular" data-testid="affiliate-estimate">
          ได้ประมาณ{" "}
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
          {days > 0 ? `เริ่มในอีก ${days} วัน` : "เริ่มวันนี้"}
        </p>
      )}
      <ShareButton url={share_url} title={product.title} />
    </li>
  )
}
