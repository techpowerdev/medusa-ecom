import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import EvoucherModule from "../modules/evoucher"

// read-only link: evoucher_pool.variant_id -> product_variant (ไม่มีตาราง pivot)
export default defineLink(
  {
    linkable: EvoucherModule.linkable.evoucherPool,
    field: "variant_id",
  },
  ProductModule.linkable.productVariant,
  { readOnly: true }
)
