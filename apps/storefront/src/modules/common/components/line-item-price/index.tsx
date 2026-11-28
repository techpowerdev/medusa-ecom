import { getPercentageDiff } from "@lib/util/get-percentage-diff"
import { lineReferenceTotal } from "@lib/util/line-item-compare-at"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { cn } from "@/lib/utils"

type LineItemPriceProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  style?: "default" | "tight"
  currencyCode: string
}

const LineItemPrice = ({
  item,
  style = "default",
  currencyCode,
}: LineItemPriceProps) => {
  // CORE-67 (กฎข้อ 125b/d): ราคาขีดฆ่าตัวเดียว = ยอดอ้างอิง (compare_at_unit_price ของ price list sale หรือ original_total)
  const originalPrice = lineReferenceTotal(item)
  const currentPrice = item.total ?? 0
  const hasReducedPrice = originalPrice - currentPrice > 0.005

  return (
    <div className="flex flex-col gap-x-2 text-muted-foreground items-end">
      <div className="text-left">
        {hasReducedPrice && (
          <>
            <p>
              {style === "default" && (
                <span className="text-muted-foreground">ราคาปกติ: </span>
              )}
              <span
                className="line-through text-muted-foreground"
                data-testid="product-original-price"
              >
                {convertToLocale({
                  amount: originalPrice,
                  currency_code: currencyCode,
                })}
              </span>
            </p>
            {style === "default" && (
              <span className="text-primary">
                -{getPercentageDiff(originalPrice, currentPrice || 0)}%
              </span>
            )}
          </>
        )}
        <span
          className={cn("text-sm leading-6 font-normal", {
            "text-primary": hasReducedPrice,
          })}
          data-testid="product-price"
        >
          {convertToLocale({
            amount: currentPrice,
            currency_code: currencyCode,
          })}
        </span>
      </div>
    </div>
  )
}

export default LineItemPrice
