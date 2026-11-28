import { convertToLocale } from "@lib/util/money"
import {
  PricedLine,
  PricedPromotion,
  lineReferenceUnitPrice,
  lineUnitPrice,
} from "@lib/util/price-breakdown"
import { cn } from "@/lib/utils"

type LineItemUnitPriceProps = {
  item: PricedLine & { quantity: number; compare_at_unit_price?: number | null }
  /** promotions ของ cart/order — แยกส่วนลดอัตโนมัติ (ลดราคาในแถว) ออกจากโค้ดของลูกค้า (กฎข้อ 158b) */
  promotions: PricedPromotion[] | null | undefined
  style?: "default" | "tight"
  currencyCode: string
  /** แสดง "× <จำนวน>" (`product-quantity`) — `/cart` ใช้ select จำนวนแทน (กฎข้อ 159a) */
  showQuantity?: boolean
}

// SFUI-24c (spec 01 กฎข้อ 159 — แทนกฎข้อ 123, 124, 125b–d): แถวสินค้าแสดงราคาต่อชิ้น × จำนวน ไม่มียอดรวมต่อแถว
// ราคาต่อชิ้น = ยอดของ line หลังส่วนลดอัตโนมัติ ÷ จำนวน (price-breakdown เดียวกับ CartTotals → Σ แถว = รวมค่าสินค้า)
// ขีดฆ่าเมื่อลดโดยไม่ต้องใส่โค้ด: อ้างอิง = compare_at_unit_price (sale) หรือ unit_price — ราคาขีดฆ่าตัวเดียวต่อแถว
const LineItemUnitPrice = ({
  item,
  promotions,
  style = "default",
  currencyCode,
  showQuantity = false,
}: LineItemUnitPriceProps) => {
  const unit = lineUnitPrice(item, promotions)
  const reference = lineReferenceUnitPrice(item)
  const hasReducedPrice = reference - unit > 0.005

  const percentage_diff = Math.round(((reference - unit) / reference) * 100)

  return (
    <div className="flex flex-col items-end text-muted-foreground justify-center h-full">
      {hasReducedPrice && (
        <>
          <p>
            {style === "default" && (
              <span className="text-muted-foreground">ราคาปกติ: </span>
            )}
            <span
              className="line-through"
              data-testid="product-unit-original-price"
              data-value={reference}
            >
              {convertToLocale({
                amount: reference,
                currency_code: currencyCode,
              })}
            </span>
          </p>
          {style === "default" && (
            <span className="text-primary">-{percentage_diff}%</span>
          )}
        </>
      )}
      <span className="text-sm leading-6 font-normal whitespace-nowrap">
        <span
          className={cn({ "text-primary": hasReducedPrice })}
          data-testid="product-unit-price"
          data-value={unit}
        >
          {convertToLocale({
            amount: unit,
            currency_code: currencyCode,
          })}
        </span>
        {showQuantity && (
          <>
            {" × "}
            <span data-testid="product-quantity">{item.quantity}</span>
          </>
        )}
      </span>
    </div>
  )
}

export default LineItemUnitPrice
