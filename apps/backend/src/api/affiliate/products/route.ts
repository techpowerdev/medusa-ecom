import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import type { ProgramScope } from "../../../modules/affiliate/utils/commission"
import { productFiltersForScope, shareUrl, variantsInScope } from "../../../modules/affiliate/utils/portal"
import { PORTAL_PROGRAM_FIELDS, refetchAffiliate } from "../helpers"
import { GetAffiliateProductsSchemaType } from "../validators"

const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "collection_id",
  "categories.id",
  "variants.id",
  "variants.title",
  "variants.calculated_price.*",
]

/**
 * spec 05 API, กฎ 9, 16: สินค้าของโปรแกรม published ที่ active/upcoming เป็นคู่ (โปรแกรม, สินค้า)
 * เรียงตาม starts_at ของโปรแกรม แล้ว id ของสินค้า; paging ข้ามโปรแกรมด้วย count ของ Query ต่อโปรแกรม
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAffiliateProductsSchemaType>,
  res: MedusaResponse
) {
  const { status, page, limit } = req.validatedQuery
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()
  const affiliate = await refetchAffiliate(req.auth_context.actor_id, req.scope)

  const { data: programs } = await query.graph({
    entity: "affiliate_program",
    fields: [...PORTAL_PROGRAM_FIELDS, "scope"],
    filters:
      status === "active"
        ? { status: "published", starts_at: { $lte: now }, ends_at: { $gt: now } }
        : { status: "published", starts_at: { $gt: now } },
    pagination: { order: { starts_at: "ASC", id: "ASC" } },
  })
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["supported_currencies.*"] })
  const currency_code = store?.supported_currencies?.find((c) => c?.is_default)?.currency_code

  const offset = (page - 1) * limit
  const products: Record<string, unknown>[] = []
  let count = 0
  for (const { scope, ...program } of programs) {
    const filters = productFiltersForScope(scope as ProgramScope)
    if (!filters) {
      continue
    }
    const { data, metadata } = await query.graph({
      entity: "product",
      fields: PRODUCT_FIELDS,
      filters,
      pagination: {
        skip: Math.max(offset - count, 0),
        take: Math.max(limit - products.length, 1),
        order: { id: "ASC" },
      },
      ...(currency_code && { context: { variants: { calculated_price: QueryContext({ currency_code }) } } }),
    })
    count += metadata?.count ?? 0
    for (const { collection_id, categories, ...product } of data.slice(0, limit - products.length)) {
      const variants = variantsInScope(scope as ProgramScope, { ...product, collection_id, categories })
      products.push({
        product: { ...product, variants },
        program,
        share_url: shareUrl(process.env.STOREFRONT_URL, affiliate.code, product.handle),
      })
    }
  }

  res.json({ products, count, page, limit })
}
