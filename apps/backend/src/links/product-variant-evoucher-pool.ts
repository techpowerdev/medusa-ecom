import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import EvoucherModule from "../modules/evoucher"

// read-only link ฝั่งกลับ: product_variant.id -> evoucher_pool.variant_id (1 pool ต่อ variant)
export default defineLink(
  {
    linkable: ProductModule.linkable.productVariant,
    field: "id",
  },
  {
    ...EvoucherModule.linkable.evoucherPool.id,
    primaryKey: "variant_id",
  },
  { readOnly: true }
)
