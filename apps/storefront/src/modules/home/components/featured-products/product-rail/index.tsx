import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

import InteractiveLink from "@modules/common/components/interactive-link"
import { CardFlashPricesProvider } from "@modules/products/components/flash-sale"
import ProductPreview from "@modules/products/components/product-preview"

export default async function ProductRail({
  collection,
  region,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
}) {
  const {
    response: { products: pricedProducts },
  } = await listProducts({
    regionId: region.id,
    queryParams: {
      collection_id: collection.id,
      fields: "*variants.calculated_price",
    },
  })

  if (!pricedProducts) {
    return null
  }

  return (
    <div className="content-container py-12 small:py-24">
      <div className="flex justify-between mb-8">
        <Text className="txt-xlarge">{collection.title}</Text>
        <InteractiveLink
          href={`/collections/${collection.handle}`}
          data-testid="product-rail-view-all"
        >
          ดูทั้งหมด
        </InteractiveLink>
      </div>
      {/* FS-14 (spec 03 กฎข้อ 19): หน้าแรก static (revalidate 60) → ราคา flash ดึงฝั่ง client ครั้งเดียวต่อ rail */}
      <CardFlashPricesProvider
        regionId={region.id}
        variantIdsByProduct={Object.fromEntries(
          pricedProducts.map((p) => [p.id, (p.variants ?? []).map((v) => v.id)])
        )}
      >
        <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-24 small:gap-y-36">
          {pricedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview
                product={product}
                region={region}
                isFeatured
                liveFlash
              />
            </li>
          ))}
        </ul>
      </CardFlashPricesProvider>
    </div>
  )
}
