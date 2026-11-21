import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { BigNumberInput } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { wrapProductsWithTaxPrices } from "@medusajs/medusa/api/store/products/helpers"
import type { ProgramScope } from "../../../modules/affiliate/utils/commission"
import {
  cardEstimate,
  ProductCard,
  ProgramCoverage,
  productFiltersForScope,
  RankedProgram,
  selectProductProgram,
  shareUrl,
  variantsInScope,
} from "../../../modules/affiliate/utils/portal"
import { affiliateOf, PORTAL_PROGRAM_FIELDS } from "../helpers"
import { GetAffiliateProductsSchemaType } from "../validators"

// field ที่พอสำหรับตัดสินว่าโปรแกรมคลุม variant ใด (กฎ 16) — ไม่ดึงราคา/รูปของสินค้านอกหน้า
const SCOPE_FIELDS = ["id", "collection_id", "categories.id", "variants.id"]
const PRODUCT_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "type_id",
  "variants.id",
  "variants.title",
  "variants.calculated_price.*",
]

type EstimateVariants = Parameters<typeof cardEstimate>[0]
type WrapRequest = Parameters<typeof wrapProductsWithTaxPrices>[0]
type WrapProducts = Parameters<typeof wrapProductsWithTaxPrices>[1]

/**
 * กฎ 48a (AF-24): เติม `calculated_amount_without_tax` ด้วย helper ของ Store API ของ Medusa (ไม่คำนวณ VAT เอง)
 * portal ไม่มี region ของผู้ซื้อ → ใช้ tax context ของ region ตั้งต้นของร้าน (หรือ region แรกของสกุลเงินร้าน) และประเทศแรกของ region
 * ไม่มี region / ไม่เปิด automatic_taxes → ไม่เติม (การ์ดใช้ราคาที่ได้แทน)
 */
const addPricesWithoutTax = async (
  req: AuthenticatedMedusaRequest<unknown, GetAffiliateProductsSchemaType>,
  products: unknown[],
  store: { default_region_id?: string | null } | undefined,
  currency_code: string | undefined
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters = store?.default_region_id ? { id: store.default_region_id } : currency_code ? { currency_code } : null
  if (!products.length || !filters) {
    return
  }
  const {
    data: [region],
  } = await query.graph({
    entity: "region",
    fields: ["id", "automatic_taxes", "countries.iso_2"],
    filters,
    pagination: { order: { created_at: "ASC" }, take: 1 },
  })
  const country_code = region?.countries?.find((c) => c?.iso_2)?.iso_2
  if (!region?.automatic_taxes || !country_code) {
    return
  }
  const taxContext = {
    taxInclusivityContext: { automaticTaxes: true },
    taxLineContext: { address: { country_code }, locale: req.locale },
  }
  await wrapProductsWithTaxPrices(
    { scope: req.scope, locale: req.locale, taxContext } as unknown as WrapRequest,
    products as WrapProducts
  )
}

/**
 * spec 05 API, กฎ 9, 16, 29: สินค้าของโปรแกรม published ที่ active/upcoming หนึ่งรายการต่อสินค้า
 * ด้วยโปรแกรมที่เลือกตามกฎ 29 — dedupe ก่อน paging (count = จำนวนสินค้าไม่ซ้ำ)
 * เรียงตาม starts_at ของโปรแกรมที่เลือก แล้ว id ของสินค้า
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetAffiliateProductsSchemaType>,
  res: MedusaResponse
) {
  const { status, page, limit } = req.validatedQuery
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()
  const affiliate = await affiliateOf(req)

  const { data } = await query.graph({
    entity: "affiliate_program",
    fields: [...PORTAL_PROGRAM_FIELDS, "scope"],
    filters:
      status === "active"
        ? { status: "published", starts_at: { $lte: now }, ends_at: { $gt: now } }
        : { status: "published", starts_at: { $gt: now } },
  })
  // ระบุ type เอง ไม่พึ่ง type ที่ generate ใน .medusa/ (CI ไม่มี) — field ตาม PORTAL_PROGRAM_FIELDS (กฎ 32d)
  type Program = RankedProgram & {
    name: string
    ends_at: Date | string
    announce_text: string | null
    commission_type: "percentage"
    attribution_window_days: number
    cap_per_order: BigNumberInput | null
    hold_days: number
  }
  const programs = data as (Program & { scope: ProgramScope })[]

  const coverages = new Map<string, ProgramCoverage<Program>[]>()
  for (const { scope, ...program } of programs) {
    const filters = productFiltersForScope(scope)
    if (!filters) {
      continue
    }
    const { data: scoped } = await query.graph({ entity: "product", fields: SCOPE_FIELDS, filters })
    for (const product of scoped) {
      const variant_ids = variantsInScope(scope, product).map((v) => v.id)
      coverages.set(product.id, [...(coverages.get(product.id) ?? []), { program, variant_ids }])
    }
  }

  const cards = [...coverages].flatMap(([product_id, covered]) => {
    const card = selectProductProgram(status, covered)
    return card ? [{ product_id, ...card }] : []
  })
  const startsAt = (card: ProductCard<Program>) => new Date(card.program.starts_at).getTime()
  cards.sort((a, b) => startsAt(a) - startsAt(b) || (a.product_id < b.product_id ? -1 : 1))
  const pageCards = cards.slice((page - 1) * limit, page * limit)

  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["default_region_id", "supported_currencies.*"] })
  const currency_code = store?.supported_currencies?.find((c) => c?.is_default)?.currency_code
  const { data: pageProducts } = pageCards.length
    ? await query.graph({
        entity: "product",
        fields: PRODUCT_FIELDS,
        filters: { id: pageCards.map((c) => c.product_id) },
        ...(currency_code && { context: { variants: { calculated_price: QueryContext({ currency_code }) } } }),
      })
    : { data: [] }
  await addPricesWithoutTax(req, pageProducts, store, currency_code)
  const productById = new Map(pageProducts.map((p) => [p.id, p]))

  const products = pageCards.flatMap(({ product_id, program, variant_ids, rate_varies }) => {
    const product = productById.get(product_id)
    if (!product) {
      return []
    }
    const variants = (product.variants ?? []).filter((v) => v && variant_ids.includes(v.id))
    return [
      {
        product: { ...product, variants },
        program,
        rate_varies,
        // กฎ 35b: rate_varies → ไม่มียอดประมาณการ
        // calculated_amount_without_tax ถูกเติมตอน runtime (addPricesWithoutTax) ไม่อยู่ใน type ที่ generate
        estimate: rate_varies ? null : cardEstimate(variants as EstimateVariants, program.commission_value),
        share_url: shareUrl(process.env.STOREFRONT_URL, affiliate.code, product.handle),
      },
    ]
  })

  res.json({ products, count: cards.length, page, limit })
}
