import { Text } from "@modules/common/components/ui"
import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import type { FlashVariantPrice } from "@lib/util/flash-sale"
import { CardFlashPrice, FlashPrice } from "../flash-sale"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region: _region,
  flashPrice,
  liveFlash,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
  /** FS-13 (spec 03 กฎข้อ 18): ราคา flash ของการ์ดบน PLP — ไม่ส่ง = แสดงราคาปกติ */
  flashPrice?: FlashVariantPrice | null
  /** FS-14 (กฎข้อ 19): อ่านราคา flash จาก `CardFlashPricesProvider` ฝั่ง client (หน้า static เช่น rail หน้าแรก) */
  liveFlash?: boolean
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group">
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          alt={product.title}
          size="full"
          isFeatured={isFeatured}
        />
        {/* qa D-1 #148: ชื่อยาว/ราคา flash คู่ราคาขีดฆ่าบนจอแคบ → ราคาขึ้นบรรทัดใหม่ ไม่ล้นการ์ด */}
        <div className="flex flex-wrap txt-compact-medium mt-4 justify-between gap-x-2">
          <Text
            className="text-ui-fg-subtle min-w-0 break-words"
            data-testid="product-title"
          >
            {product.title}
          </Text>
          <div className="flex items-center gap-x-2">
            {flashPrice ? (
              <FlashPrice price={flashPrice} />
            ) : liveFlash ? (
              <CardFlashPrice
                productId={product.id}
                fallback={
                  cheapestPrice && <PreviewPrice price={cheapestPrice} />
                }
              />
            ) : (
              cheapestPrice && <PreviewPrice price={cheapestPrice} />
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
