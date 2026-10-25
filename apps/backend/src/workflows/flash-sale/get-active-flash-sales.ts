import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { ComputeActionContext } from "@medusajs/framework/types"
import {
  flashPreviewContext,
  flashPriceFromActions,
  isCampaignRunning,
  remainingUsage,
} from "../../lib/flash-sale-preview"
import { FLASH_SALE_MODULE } from "../../modules/flash_sale"
import type FlashSaleModuleService from "../../modules/flash_sale/service"

// FS-4 (spec 03 "API", AC-4): อ่านอย่างเดียว ไม่มีการเขียนข้อมูล จึงไม่มี compensation
// flash sale = Campaign ที่มี FlashSaleConfig + automatic promotion ที่ active ≥1 ตัว ในช่วงเวลา (กฎข้อ 1)

export type GetActiveFlashSalesInput = {
  region_id?: string
  variant_ids?: string[]
}

export type ActiveFlashSale = {
  id: string
  name: string
  starts_at: Date | null
  ends_at: Date | null
  banner_text: string | null
  show_countdown: boolean
  show_remaining: boolean
  remaining_usage: number | null
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
  /** promotion code → campaign_id ของ flash promotion ที่กำลังทำงาน */
  flash_codes: Record<string, string>
}

const endsAtOrder = (s: ActiveFlashSale) => (s.ends_at ? new Date(s.ends_at).getTime() : Infinity)

export const listActiveFlashSalesStep = createStep(
  "list-active-flash-sales",
  async (_: undefined, { container }) => {
    const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
    const configs = await flashSale.listFlashSaleConfigs(
      {},
      { select: ["campaign_id", "banner_text", "show_countdown", "show_remaining"] }
    )
    if (!configs.length) {
      return new StepResponse<ListActiveFlashSalesOutput>({ flash_sales: [], flash_codes: {} })
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: promotions } = await query.graph({
      entity: "promotion",
      fields: [
        "id",
        "code",
        "campaign.id",
        "campaign.name",
        "campaign.starts_at",
        "campaign.ends_at",
        "campaign.budget.type",
        "campaign.budget.limit",
        "campaign.budget.used",
      ],
      filters: {
        campaign_id: configs.map((c) => c.campaign_id),
        is_automatic: true,
        status: "active",
      },
    })

    const now = new Date()
    const configOf = new Map(configs.map((c) => [c.campaign_id, c]))
    const sales = new Map<string, ActiveFlashSale>()
    const flash_codes: Record<string, string> = {}

    for (const promotion of promotions) {
      const campaign = promotion.campaign
      if (!campaign || !promotion.code || !isCampaignRunning(campaign, now)) {
        continue
      }
      flash_codes[promotion.code] = campaign.id
      if (sales.has(campaign.id)) {
        continue
      }
      const config = configOf.get(campaign.id)!
      sales.set(campaign.id, {
        id: campaign.id,
        name: campaign.name ?? "",
        starts_at: (campaign.starts_at as Date | null | undefined) ?? null,
        ends_at: (campaign.ends_at as Date | null | undefined) ?? null,
        banner_text: config.banner_text ?? null,
        show_countdown: config.show_countdown,
        show_remaining: config.show_remaining,
        remaining_usage: remainingUsage(campaign.budget ?? null),
      })
    }

    const flash_sales = [...sales.values()].sort((a, b) => endsAtOrder(a) - endsAtOrder(b))
    return new StepResponse<ListActiveFlashSalesOutput>({ flash_sales, flash_codes })
  }
)

type PreviewFlashPricesInput = {
  region_id?: string
  variant_ids?: string[]
  flash_codes: Record<string, string>
}

/**
 * ราคา flash ต่อ variant: ให้ Promotion module คำนวณบน line สังเคราะห์ (ADR-003, กฎข้อ 2)
 * แยก compute ทีละ variant เพื่อไม่ให้ allocation `across` / order-level กระจายข้าม variant
 */
export const previewFlashPricesStep = createStep(
  "preview-flash-prices",
  async ({ region_id, variant_ids, flash_codes }: PreviewFlashPricesInput, { container }) => {
    if (!region_id || !variant_ids?.length) {
      return new StepResponse<FlashVariantPrice[]>([])
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "currency_code"],
      filters: { id: region_id },
    })
    const region = regions[0]
    if (!region) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Region with id: ${region_id} was not found`)
    }

    const { data: variants } = await query.graph({
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
        "calculated_price.calculated_amount",
      ],
      filters: { id: variant_ids },
      context: {
        calculated_price: QueryContext({ region_id, currency_code: region.currency_code }),
      },
    })

    const flashCodes = new Set(Object.keys(flash_codes))
    const promotionModule = container.resolve(Modules.PROMOTION)
    const byId = new Map(variants.map((v) => [v.id, v]))

    const prices = await Promise.all(
      [...new Set(variant_ids)].map(async (variantId): Promise<FlashVariantPrice | null> => {
        const variant = byId.get(variantId)
        // calculated_price มาจาก QueryContext — ไม่อยู่ใน type ที่ generate ของ variant
        const amount = (variant as { calculated_price?: { calculated_amount?: number | null } | null } | undefined)
          ?.calculated_price?.calculated_amount
        if (!variant || variant.product?.status !== "published" || amount == null) {
          return null
        }
        const original_price = Number(amount)
        let flash_price: number | null = null
        let campaign_id: string | null = null

        if (flashCodes.size) {
          const context = flashPreviewContext({
            currency_code: region.currency_code,
            region_id,
            variant: {
              id: variant.id,
              product_id: variant.product_id,
              product: variant.product as Record<string, unknown> | null,
            },
            amount: original_price,
          })
          const actions = await promotionModule.computeActions([], context as ComputeActionContext)
          const computed = actions as { action: string; code: string; amount?: number }[]
          flash_price = flashPriceFromActions(original_price, computed, flashCodes)
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
      })
    )

    return new StepResponse(prices.filter((p): p is FlashVariantPrice => p !== null))
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
