import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import {
  AttributionPlan,
  AttributionProgram,
  attributionRejection,
  planAttribution,
} from "../../modules/affiliate/utils/attribution"

const DAY_MS = 24 * 60 * 60 * 1000

export type AttributeAffiliateOrderInput = { order_id: string }

export type PreparedAttribution = (AttributionPlan & { order_id: string; currency_code: string }) | null

/**
 * อ่านอย่างเดียว: order + cart.metadata.affiliate_token → ตรวจลายเซ็น/affiliate/โปรแกรม → แผน (planAttribution)
 * หยุด (null) เมื่อ order นี้มี attribution แล้ว (กฎ 15, AC-10) หรือไม่มี/ปฏิเสธ token (AC-11 log)
 */
export const prepareAffiliateAttributionStep = createStep(
  "prepare-affiliate-attribution",
  async (input: AttributeAffiliateOrderInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    const [existing] = await service.listAffiliateAttributions(
      { order_id: input.order_id },
      { select: ["id"], take: 1 }
    )
    if (existing) {
      return new StepResponse<PreparedAttribution>(null)
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "currency_code",
        "created_at",
        // field ยอดรวมระดับ order ทำให้ Order module คำนวณ totals ของ item (subtotal/discount_subtotal) ให้ด้วย
        "subtotal",
        "cart.metadata",
        "items.id",
        "items.created_at",
        "items.variant_id",
        "items.product_id",
        "items.subtotal",
        "items.discount_subtotal",
      ],
      filters: { id: input.order_id },
    })
    const token = (order?.cart?.metadata as Record<string, unknown> | null | undefined)?.affiliate_token
    if (!order || token === undefined || token === null || token === "") {
      return new StepResponse<PreparedAttribution>(null)
    }

    const click = await service.verifyClickToken(token)
    const [affiliate] = click
      ? await service.listAffiliates({ id: click.affiliate_id }, { select: ["id", "email", "status"], take: 1 })
      : []
    if (!click || !affiliate) {
      logger.warn(`Affiliate attribution rejected for order ${input.order_id}: invalid affiliate_token`)
      return new StepResponse<PreparedAttribution>(null)
    }

    const placedAt = new Date(order.created_at as string | Date)
    const rejection = attributionRejection(click, affiliate, placedAt)
    if (rejection) {
      logger.info(`Affiliate attribution skipped for order ${input.order_id}: ${rejection}`)
      return new StepResponse<PreparedAttribution>(null)
    }
    const programs = await service.listAffiliatePrograms({
      status: "published",
      starts_at: { $lte: placedAt },
      ends_at: { $gt: placedAt },
    })

    // Q2: นับเฉพาะ category ที่ผูกกับสินค้าโดยตรง (ไม่ไล่ category ลูก/แม่)
    // item totals (subtotal/discount_subtotal) เป็น field คำนวณ ไม่อยู่ใน type ของ Query จึงอ่านเป็น ItemTotals
    type ItemTotals = { subtotal: number; discount_subtotal?: number | null }
    type ProductScope = { id: string; collection_id?: string | null; categories?: ({ id: string } | null)[] | null }
    const items = (order.items ?? []).filter((i) => !!i).map((i) => i!)
    const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => !!id))]
    const products: ProductScope[] = productIds.length
      ? (
          await query.graph({
            entity: "product",
            fields: ["id", "collection_id", "categories.id"],
            filters: { id: productIds },
          })
        ).data
      : []
    const productById = new Map(products.map((p) => [p.id, p]))

    const plan = planAttribution({
      click,
      affiliate,
      order: { email: order.email, placed_at: placedAt },
      programs: programs as unknown as AttributionProgram[],
      items: items.map((item) => {
        const product = productById.get(item.product_id ?? "")
        const totals = item as unknown as ItemTotals
        return {
          id: item.id,
          created_at: item.created_at as Date | string,
          variant_id: item.variant_id,
          product_collection_id: product?.collection_id ?? null,
          product_category_ids: (product?.categories ?? []).flatMap((c) => (c ? [c.id] : [])),
          subtotal: totals.subtotal,
          discount_subtotal: totals.discount_subtotal ?? 0,
        }
      }),
    })

    return new StepResponse<PreparedAttribution>(
      plan && { ...plan, order_id: order.id, currency_code: order.currency_code }
    )
  }
)

// unique order_id กันการสร้างซ้ำ (กฎ 15); compensation ลบเฉพาะแถวของรอบที่ล้ม (ข้อยกเว้นกฎ 5)
export const createAffiliateAttributionStep = createStep(
  "create-affiliate-attribution",
  async (plan: PreparedAttribution, { container }) => {
    if (!plan) {
      return new StepResponse(null)
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const attribution = await service.createAffiliateAttributions({
      order_id: plan.order_id,
      affiliate_id: plan.affiliate_id,
      program_id: plan.program_id,
      attributed_at: new Date(),
    })
    return new StepResponse(attribution, attribution.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.deleteAffiliateAttributions(id)
  }
)

// entry `pending`, matures_at = now + hold_days ของโปรแกรมที่ให้ค่าคอม line นั้น
export const createAffiliateCommissionEntriesStep = createStep(
  "create-affiliate-commission-entries",
  async (plan: PreparedAttribution, { container }) => {
    if (!plan?.entries.length) {
      return new StepResponse([])
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const now = Date.now()
    const entries = await service.createAffiliateCommissionEntries(
      plan.entries.map((entry) => ({
        affiliate_id: plan.affiliate_id,
        program_id: entry.program_id,
        order_id: plan.order_id,
        line_item_id: entry.line_item_id,
        amount: entry.amount,
        currency: plan.currency_code,
        status: "pending" as const,
        matures_at: new Date(now + entry.hold_days * DAY_MS),
      }))
    )
    return new StepResponse(
      entries,
      entries.map((e) => e.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.deleteAffiliateCommissionEntries(ids)
  }
)

/**
 * spec 05 subscriber `order.placed` (AF-3): attribution + commission entries ใน workflow เดียว
 * lock ต่อ order ให้ event ที่ส่งพร้อมกันทำทีละรอบ รอบหลังเห็น attribution แล้วหยุด (AC-10)
 */
export const attributeAffiliateOrderWorkflow = createWorkflow(
  "attribute-affiliate-order",
  function (input: AttributeAffiliateOrderInput) {
    const key = transform({ input }, ({ input }) => `affiliate-attribution:${input.order_id}`)
    acquireLockStep({ key, timeout: 30, ttl: 60 })

    const plan = prepareAffiliateAttributionStep(input)
    const attribution = createAffiliateAttributionStep(plan)
    const entries = createAffiliateCommissionEntriesStep(plan)

    releaseLockStep({ key })
    return new WorkflowResponse({ attribution, entries })
  }
)
