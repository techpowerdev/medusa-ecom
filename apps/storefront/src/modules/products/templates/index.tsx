import React, { Suspense } from "react"

import { evoucherPoolOf, voucherVariantsOf } from "@lib/util/evoucher"
import EvoucherPartnerBlock, {
  EvoucherPartnerBlockView,
} from "@modules/evoucher/components/partner-block"
import VariantImageGallery from "@modules/products/components/image-gallery/variant-image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

  // EV-7b (spec 02 AC-36): ส่งเฉพาะ field ที่บล็อกพาร์ทเนอร์ใช้ไปยัง client component
  const voucherVariants = voucherVariantsOf(product.variants)

  return (
    <>
      <div
        className="content-container  flex flex-col small:flex-row small:items-start py-6 relative"
        data-testid="product-container"
      >
        <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-6">
          <ProductInfo product={product} />
          {voucherVariants && (
            // หน้าเป็น static: `?v_id=` อ่านได้หลัง hydrate — ระหว่างนั้นแสดงของ variant ตั้งต้น
            <Suspense
              fallback={
                <EvoucherPartnerBlockView
                  pool={evoucherPoolOf({ variants: voucherVariants }, null)}
                />
              }
            >
              <EvoucherPartnerBlock variants={voucherVariants} />
            </Suspense>
          )}
          <ProductTabs product={product} />
        </div>
        <div className="block w-full relative">
          <VariantImageGallery product={product} />
        </div>
        <div className="flex flex-col small:sticky small:top-48 small:py-0 small:max-w-[300px] w-full py-8 gap-y-12">
          <ProductActions product={product} region={region} />
        </div>
      </div>
      <div
        className="content-container my-16 small:my-32"
        data-testid="related-products-container"
      >
        <Suspense fallback={<SkeletonRelatedProducts />}>
          <RelatedProducts product={product} countryCode={countryCode} />
        </Suspense>
      </div>
    </>
  )
}

export default ProductTemplate
