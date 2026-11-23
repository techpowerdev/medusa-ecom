import type { PortalProduct } from "@lib/data/affiliate-portal"
import { cardPrice, countdownText, PortalTab, priceVaries } from "@lib/util/affiliate-portal"
import { formatDate } from "@lib/util/date"
import { convertToLocale } from "@lib/util/money"
import Thumbnail from "@modules/products/components/thumbnail"

import ShareLinkButton from "@modules/common/components/share-link-button"

// spec 05 Storefront + กฎ 29: การ์ดเดียวต่อสินค้า อัตราของโปรแกรมที่เลือก (rate_varies → "สูงสุด X%")
// AF-8c กฎ 35b: rate_varies ไม่แสดงยอดประมาณการ — API ส่ง estimate=null
// AF-24 กฎ 48a: ยอดประมาณการมาจาก API (ราคาก่อน VAT × อัตรา) storefront ไม่คำนวณเงินเอง
export default function AffiliateProductCard({ item, tab }: { item: PortalProduct; tab: PortalTab }) {
  const { product, program, rate_varies, estimate, share_url } = item
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
      {estimate && !rate_varies && (
        <>
          <p className="text-small-regular" data-testid="affiliate-estimate">
            {priceVaries(product.variants) ? "ได้ประมาณตั้งแต่" : "ได้ประมาณ"}{" "}
            {convertToLocale({ amount: estimate.amount, currency_code: estimate.currency_code })} ต่อชิ้น
          </p>
          {estimate.excludes_tax && (
            <p className="text-small-regular text-ui-fg-subtle" data-testid="affiliate-estimate-basis">
              {
                // eslint-disable-next-line no-restricted-syntax -- "VAT" เป็นหน่วย/รหัสตามภาคผนวก 2026-11-13 ของ ADR-014 ป้ายตาม spec 05 กฎ 48a
                "ค่าคอมโดยประมาณ (คิดจากราคาก่อน VAT)"
              }
            </p>
          )}
        </>
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
      <ShareLinkButton
        url={share_url}
        shareTitle={product.title}
        label="แชร์"
        buttonTestId="affiliate-share-button"
        statusTestId="affiliate-share-status"
      />
    </li>
  )
}
