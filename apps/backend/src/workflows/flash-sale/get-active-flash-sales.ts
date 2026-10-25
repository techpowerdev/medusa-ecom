import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
  calculateAmountsWithTax,
} from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type {
  CampaignDTO,
  ComputeActionContext,
  FindConfig,
  FilterablePromotionProps,
  IPromotionModuleService,
  ItemTaxLineDTO,
  PromotionDTO,
} from "@medusajs/framework/types"
import {
  type ComputedActionLike,
  flashPreviewContext,
  flashPriceFromActions,
  flashSaleAvailability,
  mapWithConcurrency,
} from "../../lib/flash-sale-preview"
import { FLASH_SALE_MODULE } from "../../modules/flash_sale"
import type FlashSaleModuleService from "../../modules/flash_sale/service"

// FS-4 (spec 03 "API", AC-4): อ่านอย่างเดียว ไม่มีการเขียนข้อมูล จึงไม่มี compensation
// flash sale = Campaign ที่มี FlashSaleConfig + automatic promotion ที่ active ≥1 ตัว ในช่วงเวลา (กฎข้อ 1)

/** computeActions ยิงหลาย query ต่อครั้ง — จำกัดงานพร้อมกันต่อ request เพื่อไม่แย่ง DB pool กับ complete cart */
export const PREVIEW_CONCURRENCY = 5

export type GetActiveFlashSalesInput = {
  region_id?: string
  variant_ids?: string[]
  /** sales channel ของ publishable key — กรอง variant แบบเดียวกับ store route ของ Medusa */
  sales_channel_ids?: string[]
}

export type ActiveFlashSale = {
  id: string
  name: string
  starts_at: Date | null
  ends_at: Date | null
  banner_text: string | null
  show_countdown: boolean
  show_remaining: boolean
  /** FS-7: จาก `FlashSaleConfig` (units_sold/total_cap) ไม่ใช่ campaign budget (กฎข้อ 4) */
  sold_out: boolean
  remaining_units: number | null
}

export type FlashVariantPrice = {
  variant_id: string
  currency_code: string
  original_price: number
  flash_price: number | null
  campaign_id: string | null
}

type ListActiveFlashSalesOutput = {
  flash_sales: ActiveFlashSale[]
  /** promotion code → campaign_id ของ flash promotion แบบ `target_type: "items"` ที่กำลังทำงาน */
  flash_codes: Record<string, string>
}

// `listActivePromotions` (status active + ช่วงเวลา campaign) มีใน service 2.22.1 แต่ไม่อยู่ใน interface
type PromotionServiceWithActive = IPromotionModuleService & {
  listActivePromotions(
    filters: FilterablePromotionProps,
    config: FindConfig<PromotionDTO>
  ): Promise<PromotionDTO[]>
}

const endsAtOrder = (s: ActiveFlashSale) => (s.ends_at ? new Date(s.ends_at).getTime() : Infinity)

export const listActiveFlashSalesStep = createStep(
  "list-active-flash-sales",
  async (_: undefined, { container }) => {
    const promotionModule = container.resolve<PromotionServiceWithActive>(Modules.PROMOTION)
    const promotions = (
      await promotionModule.listActivePromotions(
        { is_automatic: true },
        { relations: ["application_method", "campaign"] }
      )
    ).filter((p) => p.campaign?.id && p.code)
    if (!promotions.length) {
      return new StepResponse<ListActiveFlashSalesOutput>({ flash_sales: [], flash_codes: {} })
    }

    const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    const configs = await flashSale.listFlashSaleConfigs(
      { campaign_id: [...new Set(promotions.map((p) => p.campaign!.id))] },
      { select: ["campaign_id", "banner_text", "show_countdown", "show_remaining", "total_cap", "units_sold"] }
    )
    const configOf = new Map(configs.map((c) => [c.campaign_id, c]))
    const sales = new Map<string, ActiveFlashSale>()
    const flash_codes: Record<string, string> = {}

    for (const promotion of promotions) {
      const campaign = promotion.campaign as CampaignDTO
      const config = configOf.get(campaign.id)
      if (!config) {
        continue
      }
      // order-level promotion บน line สังเคราะห์ชิ้นเดียวทำให้ราคาต่ำเกินจริง → preview เฉพาะ items
      if (promotion.application_method?.target_type === "items") {
        flash_codes[promotion.code!] = campaign.id
      }
      if (!sales.has(campaign.id)) {
        sales.set(campaign.id, {
          id: campaign.id,
          name: campaign.name ?? "",
          starts_at: (campaign.starts_at as Date | null | undefined) ?? null,
          ends_at: (campaign.ends_at as Date | null | undefined) ?? null,
          banner_text: config.banner_text ?? null,
          show_countdown: config.show_countdown,
          show_remaining: config.show_remaining,
          ...flashSaleAvailability(config),
        })
      }
    }

    const flash_sales = [...sales.values()].sort((a, b) => endsAtOrder(a) - endsAtOrder(b))
    return new StepResponse<ListActiveFlashSalesOutput>({ flash_sales, flash_codes })
  }
)

type PreviewFlashPricesInput = {
  region_id?: string
  variant_ids?: string[]
  sales_channel_ids?: string[]
  flash_codes: Record<string, string>
}

type PreviewVariantRow = {
  id: string
  product_id: string | null
  product: {
    id: string
    status: string
    type_id: string | null
    sales_channels?: { id: string }[] | null
  } & Record<string, unknown>
  calculated_price?: {
    calculated_amount?: number | null
    is_calculated_price_tax_inclusive?: boolean
  } | null
}

/**
 * ราคา flash ต่อ variant: ให้ Promotion module คำนวณบน line สังเคราะห์ (ADR-003, กฎข้อ 2)
 * แยก compute ทีละ variant (allocation `across` ไม่กระจายข้าม variant) โดยจำกัดพร้อมกันไม่เกิน PREVIEW_CONCURRENCY
 */
export const previewFlashPricesStep = createStep(
  "preview-flash-prices",
  async (
    { region_id, variant_ids, sales_channel_ids, flash_codes }: PreviewFlashPricesInput,
    { container }
  ) => {
    if (!region_id || !variant_ids?.length) {
      return new StepResponse<FlashVariantPrice[]>([])
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code", "automatic_taxes", "countries.iso_2"],
      filters: { id: region_id },
    })
    const region = regions[0]
    if (!region) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Region with id: ${region_id} was not found`)
    }

    const { data } = await query.graph({
      entity: "variant",
      fields: [
        "id",
        "product_id",
        "product.id",
        "product.status",
        "product.collection_id",
        "product.type_id",
        "product.categories.id",
        "product.tags.id",
        "product.sales_channels.id",
        "calculated_price.calculated_amount",
        "calculated_price.is_calculated_price_tax_inclusive",
      ],
      filters: { id: variant_ids },
      context: {
        calculated_price: QueryContext({ region_id, currency_code: region.currency_code }),
      },
    })
    const channels = sales_channel_ids ? new Set(sales_channel_ids) : null
    const byId = new Map(
      (data as unknown as PreviewVariantRow[])
        .filter(
          (v) =>
            v.product?.status === "published" &&
            v.calculated_price?.calculated_amount != null &&
            (!channels || (v.product.sales_channels ?? []).some((sc) => channels.has(sc.id)))
        )
        .map((v) => [v.id, v])
    )
    const variants = [...new Set(variant_ids)].map((id) => byId.get(id)).filter((v) => !!v)

    // ภาษีแบบเดียวกับ cart: subtotal ไม่รวมภาษี / original_total รวมภาษี (region ประเทศเดียว + automatic_taxes)
    const countries = (region.countries ?? []).filter((c) => !!c?.iso_2)
    const taxLinesOf = new Map<string, { rate: number }[]>()
    if (region.automatic_taxes && countries.length === 1 && variants.length) {
      const taxModule = container.resolve(Modules.TAX)
      const taxLines = await taxModule.getTaxLines(
        variants.map((v) => ({
          id: v.id,
          product_id: v.product.id,
          product_type_id: v.product.type_id ?? undefined,
          quantity: 1,
          unit_price: Number(v.calculated_price!.calculated_amount),
          currency_code: region.currency_code,
        })),
        { address: { country_code: countries[0]!.iso_2! } }
      )
      for (const line of taxLines as ItemTaxLineDTO[]) {
        taxLinesOf.set(line.line_item_id, [...(taxLinesOf.get(line.line_item_id) ?? []), line])
      }
    }

    const flashCodes = new Set(Object.keys(flash_codes))
    const promotionModule = container.resolve(Modules.PROMOTION)

    const prices = await mapWithConcurrency(
      variants,
      PREVIEW_CONCURRENCY,
      async (variant): Promise<FlashVariantPrice> => {
        const original_price = Number(variant.calculated_price!.calculated_amount)
        let flash_price: number | null = null
        let campaign_id: string | null = null

        if (flashCodes.size) {
          const { priceWithTax, priceWithoutTax } = calculateAmountsWithTax({
            taxLines: taxLinesOf.get(variant.id) ?? [],
            amount: original_price,
            includesTax: variant.calculated_price!.is_calculated_price_tax_inclusive,
          })
          const context = flashPreviewContext({
            currency_code: region.currency_code,
            region_id,
            variant: { id: variant.id, product_id: variant.product_id, product: variant.product },
            subtotal: priceWithoutTax,
            original_total: priceWithTax,
          })
          // ระบุเฉพาะ flash promotion แบบ items + ปิด auto discovery: promotion อื่น (order-level, ไม่ใช่ flash)
          // ที่ value สูงกว่าจะไม่ถูกหักก่อนแล้วทำให้ส่วนลด flash บน line สังเคราะห์เพี้ยน; rule ของ promotion ยังถูกประเมินกับ context
          const actions = await promotionModule.computeActions([...flashCodes], context as ComputeActionContext, {
            prevent_auto_promotions: true,
          })
          const computed = actions as ComputedActionLike[]
          flash_price = flashPriceFromActions(
            { price: original_price, subtotal: priceWithoutTax, original_total: priceWithTax },
            computed,
            flashCodes
          )
          const flashAction = computed.find((a) => a.action === "addItemAdjustment" && flashCodes.has(a.code))
          campaign_id = flashAction ? flash_codes[flashAction.code] : null
        }

        return {
          variant_id: variant.id,
          currency_code: region.currency_code,
          original_price,
          flash_price,
          campaign_id,
        }
      }
    )

    return new StepResponse(prices)
  }
)

export const getActiveFlashSalesWorkflow = createWorkflow(
  "get-active-flash-sales",
  (input: GetActiveFlashSalesInput) => {
    const active = listActiveFlashSalesStep()
    const variants = previewFlashPricesStep(
      transform({ input, active }, ({ input, active }) => ({
        region_id: input.region_id,
        variant_ids: input.variant_ids,
        sales_channel_ids: input.sales_channel_ids,
        flash_codes: active.flash_codes,
      }))
    )
    const result = transform({ active, variants }, ({ active, variants }) => ({
      flash_sales: active.flash_sales,
      variants,
    }))
    return new WorkflowResponse(result)
  }
)
