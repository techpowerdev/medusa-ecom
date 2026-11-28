import { cn } from "@/lib/utils"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
  struck,
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  /** FS-16 (spec 03 กฎข้อ 21b): variant มีราคา flash → ราคานี้เป็นราคาเดิม แสดงแบบขีดฆ่า (ราคาจริงอยู่ในกล่อง flash) */
  struck?: boolean
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-gray-100 animate-pulse" />
  }

  return (
    <div className="flex flex-col text-foreground">
      <span
        className={cn("text-2xl leading-[36px] font-semibold", {
          "text-primary": selectedPrice.price_type === "sale",
        })}
      >
        {!variant && "เริ่มต้น "}
        <span
          className={cn({ "line-through text-muted-foreground": struck })}
          data-testid="product-price"
          data-value={selectedPrice.calculated_price_number}
        >
          {selectedPrice.calculated_price}
        </span>
      </span>
      {selectedPrice.price_type === "sale" && (
        <>
          <p>
            <span className="text-muted-foreground">ราคาปกติ: </span>
            <span
              className="line-through"
              data-testid="original-product-price"
              data-value={selectedPrice.original_price_number}
            >
              {selectedPrice.original_price}
            </span>
          </p>
          <span className="text-primary">
            -{selectedPrice.percentage_diff}%
          </span>
        </>
      )}
    </div>
  )
}
