import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import {
  createOrderFulfillmentWorkflow,
  sendNotificationsStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService, { ClaimCodesForOrderResult } from "../../modules/evoucher/service"
import { expiryCutoff } from "../../modules/evoucher/utils/expiry"
import { EmailTemplates } from "../../modules/resend/templates"

// spec 02 กฎข้อ 8: หา option Digital delivery ด้วย type.code ไม่ใช่ชื่อ
const DIGITAL_OPTION_TYPE_CODE = "digital-delivery"
export const EVOUCHER_BACKORDERED_METADATA_KEY = "evoucher_backordered"
const TRIGGER = "payment.captured"

type OrderItem = {
  id: string
  title?: string | null
  variant_id?: string | null
  quantity: number
  metadata?: Record<string, unknown> | null
}

type Order = {
  id: string
  display_id?: number | null
  email?: string | null
  customer_id?: string | null
  items?: (OrderItem | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

type VoucherLine = {
  line_item_id: string
  pool_id: string
  pool_name: string
  title: string
  quantity: number
}

export type AllocateAndDeliverEvouchersInput = {
  order_id: string
  /** mailbox เดียวของทีม (env `EVOUCHER_ADMIN_EMAIL`, กฎข้อ 9) — ไม่ได้ตั้ง → log warning และไม่ส่ง */
  admin_email?: string
}

// line item ของ order ที่ variant มี EvoucherPool (กฎข้อ 1)
export const resolveEvoucherLinesStep = createStep(
  "resolve-evoucher-lines",
  async (input: { order: Order }, { container }) => {
    const items = (input.order.items ?? []).filter((i): i is OrderItem => !!i?.variant_id)
    if (!items.length) {
      return new StepResponse([] as VoucherLine[])
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: pools } = await query.graph({
      entity: "evoucher_pool",
      fields: ["id", "name", "variant_id"],
      filters: { variant_id: items.map((i) => i.variant_id!) },
    })
    const byVariant = new Map(pools.map((p) => [p.variant_id, p]))
    const lines: VoucherLine[] = []
    for (const item of items) {
      const pool = byVariant.get(item.variant_id!)
      if (pool) {
        lines.push({
          line_item_id: item.id,
          pool_id: pool.id,
          pool_name: pool.name,
          title: item.title ?? "",
          quantity: Number(item.quantity),
        })
      }
    }
    return new StepResponse(lines)
  }
)

// claim แบบ atomic + idempotent (service.claimCodesForOrder); compensation ปล่อย code ที่ claim รอบนี้กลับเป็น available
export const claimEvoucherCodesStep = createStep(
  "claim-evoucher-codes",
  async (input: { order: Order; lines: VoucherLine[] }, { container }) => {
    const empty: ClaimCodesForOrderResult = { allocated: [], backordered: [], skipped: [] }
    if (!input.lines.length) {
      return new StepResponse(empty, [] as string[])
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    // ล้มก่อน claim ถ้า key ผิด (ต้องถอดรหัส code ลงอีเมล)
    await service.assertEncryptionKey()
    const result = await service.claimCodesForOrder({
      order_id: input.order.id,
      customer_id: input.order.customer_id,
      items: input.lines,
      // กฎข้อ 2: ไม่เลือก code ที่หมดอายุภายใน 7 วัน
      expires_after: expiryCutoff(new Date()),
    })
    return new StepResponse(
      result,
      result.allocated.flatMap((a) => a.code_ids)
    )
  },
  async (codeIds, { container }) => {
    if (!codeIds?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherCodes(
      codeIds.map((id) => ({
        id,
        status: "available" as const,
        order_id: null,
        order_line_item_id: null,
        customer_id: null,
        allocated_at: null,
        delivered_at: null,
        delivered_to_email: null,
      }))
    )
  }
)

// mark line item เป็น backordered ใน metadata (ไม่ทำให้ order ล้ม)
export const flagEvoucherBackorderedLineItemsStep = createStep(
  "flag-evoucher-backordered-line-items",
  async (input: { order: Order; line_item_ids: string[] }, { container }) => {
    const items = (input.order.items ?? []).filter(
      (i): i is OrderItem => !!i && input.line_item_ids.includes(i.id)
    )
    const previous = items.map((i) => ({ id: i.id, metadata: i.metadata ?? {} }))
    const orderModule = container.resolve(Modules.ORDER)
    for (const item of previous) {
      await orderModule.updateOrderLineItems(item.id, {
        metadata: { ...item.metadata, [EVOUCHER_BACKORDERED_METADATA_KEY]: true },
      })
    }
    return new StepResponse(undefined, previous)
  },
  async (previous, { container }) => {
    if (!previous?.length) {
      return
    }
    const orderModule = container.resolve(Modules.ORDER)
    for (const item of previous) {
      await orderModule.updateOrderLineItems(item.id, { metadata: item.metadata })
    }
  }
)

// กฎข้อ 9 / AC-17: อีเมล backordered ถึง EVOUCHER_ADMIN_EMAIL เท่านั้น
export const buildEvoucherBackorderedNotificationsStep = createStep(
  "build-evoucher-backordered-notifications",
  async (
    input: { order: Order; lines: VoucherLine[]; backordered: string[]; admin_email?: string },
    { container }
  ) => {
    if (!input.backordered.length) {
      return new StepResponse([] as CreateNotificationDTO[])
    }
    if (!input.admin_email) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(
          `evoucher: order ${input.order.id} is backordered but EVOUCHER_ADMIN_EMAIL is not set — skipping admin email`
        )
      return new StepResponse([] as CreateNotificationDTO[])
    }
    const ids = [...input.backordered].sort()
    const notification: CreateNotificationDTO = {
      to: input.admin_email,
      channel: "email",
      template: EmailTemplates.EVOUCHER_BACKORDERED,
      data: {
        order: { id: input.order.id, display_id: input.order.display_id, email: input.order.email },
        items: input.lines
          .filter((l) => ids.includes(l.line_item_id))
          .map((l) => ({
            line_item_id: l.line_item_id,
            title: l.title,
            quantity: l.quantity,
            pool_name: l.pool_name,
          })),
      },
      trigger_type: TRIGGER,
      resource_id: input.order.id,
      resource_type: "order",
      // AC-7: รันซ้ำแล้วยัง backordered ชุดเดิม → ไม่ส่งซ้ำ
      idempotency_key: `evoucher-backordered-${input.order.id}-${ids.join(",")}`,
    }
    return new StepResponse([notification])
  }
)

// fulfillment ผ่าน provider digital (ADR-006): ระบุ option Digital delivery เอง ไม่พึ่ง shipping_methods[0]
export const resolveDigitalShippingOptionStep = createStep(
  "resolve-digital-shipping-option",
  async (input: { order: Order }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: options } = await query.graph({
      entity: "shipping_option",
      fields: ["id"],
      filters: { type: { code: DIGITAL_OPTION_TYPE_CODE } },
    })
    if (!options.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Shipping option with type.code "${DIGITAL_OPTION_TYPE_CODE}" not found`
      )
    }
    const used = new Set((input.order.shipping_methods ?? []).map((m) => m?.shipping_option_id))
    return new StepResponse((options.find((o) => used.has(o.id)) ?? options[0]).id)
  }
)

export const markEvoucherCodesDeliveredStep = createStep(
  "mark-evoucher-codes-delivered",
  async (input: { code_ids: string[]; email?: string | null }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const delivered_at = new Date()
    await service.updateEvoucherCodes(
      input.code_ids.map((id) => ({
        id,
        status: "delivered" as const,
        delivered_at,
        delivered_to_email: input.email ?? null,
      }))
    )
    return new StepResponse(undefined, input.code_ids)
  },
  async (codeIds, { container }) => {
    if (!codeIds?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    // เฉพาะแถวที่ยัง delivered: ไม่ทับ code ที่ compensation ของ claim คืนเป็น available ไปแล้ว
    await service.updateEvoucherCodes({
      selector: { id: codeIds, status: "delivered" },
      data: { status: "allocated", delivered_at: null, delivered_to_email: null },
    })
  }
)

// AC-2: อีเมลเดียวต่อรอบ มีทุก code + PIN + วิธีใช้ + วันหมดอายุ (ถอดรหัสตอนส่งเท่านั้น)
export const buildEvoucherDeliveredNotificationsStep = createStep(
  "build-evoucher-delivered-notifications",
  async (
    input: { order: Order; lines: VoucherLine[]; allocated: ClaimCodesForOrderResult["allocated"] },
    { container }
  ) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const codes = await service.listEvoucherCodes(
      { id: input.allocated.flatMap((a) => a.code_ids) },
      { relations: ["pool", "pool.partner"], order: { expires_at: "ASC" } }
    )
    const vouchers = await Promise.all(
      input.allocated.map(async (a) => {
        const line = input.lines.find((l) => l.line_item_id === a.line_item_id)!
        const rows = codes.filter((c) => c.order_line_item_id === a.line_item_id)
        const pool = rows[0].pool
        return {
          title: line.title,
          partner: { name: pool.partner.name, logo_url: pool.partner.logo_url },
          how_to_use: pool.how_to_use,
          validity_note: pool.validity_note,
          codes: await Promise.all(
            rows.map(async (c) => ({
              code: await service.decryptSecret(c.code),
              pin: c.pin ? await service.decryptSecret(c.pin) : null,
              expires_at: c.expires_at ? new Date(c.expires_at).toISOString() : null,
            }))
          ),
        }
      })
    )
    const lineIds = input.allocated.map((a) => a.line_item_id).sort()
    const notification: CreateNotificationDTO = {
      to: input.order.email!,
      channel: "email",
      template: EmailTemplates.EVOUCHER_DELIVERED,
      data: { order: { id: input.order.id, display_id: input.order.display_id }, vouchers },
      trigger_type: TRIGGER,
      resource_id: input.order.id,
      resource_type: "order",
      idempotency_key: `evoucher-delivered-${input.order.id}-${lineIds.join(",")}`,
    }
    return new StepResponse([notification])
  }
)

/**
 * EV-4 (spec 02, ADR-006): หลัง payment.captured → claim code ต่อ voucher line item × quantity →
 * backordered: flag metadata + อีเมล admin (กฎข้อ 9) → fulfillment ผ่าน provider digital → mark delivered →
 * อีเมล `evoucher.delivered` ถึงลูกค้า (ขั้นสุดท้าย: ล้มก่อนหน้านี้ → compensation คืน code/ยกเลิก fulfillment)
 * Idempotent (AC-7): line item ที่มี code แล้วถูกข้าม
 */
export const allocateAndDeliverEvouchersWorkflow = createWorkflow(
  "allocate-and-deliver-evouchers",
  function (input: AllocateAndDeliverEvouchersInput) {
    const { data: orders } = useQueryGraphStep({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "customer_id",
        "items.id",
        "items.title",
        "items.variant_id",
        "items.quantity",
        "items.metadata",
        "shipping_methods.shipping_option_id",
      ],
      filters: { id: input.order_id },
      options: { throwIfKeyNotFound: true },
    })
    const order = transform({ orders }, ({ orders }) => orders[0] as unknown as Order)

    const lines = resolveEvoucherLinesStep({ order })
    const claim = claimEvoucherCodesStep({ order, lines })

    const backordered = transform({ claim }, ({ claim }) => claim.backordered)
    when({ backordered }, ({ backordered }) => backordered.length > 0).then(() => {
      flagEvoucherBackorderedLineItemsStep({ order, line_item_ids: backordered })
    })
    const adminNotifications = buildEvoucherBackorderedNotificationsStep({
      order,
      lines,
      backordered,
      admin_email: input.admin_email,
    })
    when({ adminNotifications }, ({ adminNotifications }) => adminNotifications.length > 0).then(() => {
      sendNotificationsStep(adminNotifications).config({ name: "send-evoucher-backordered-notifications" })
    })

    when({ claim }, ({ claim }) => claim.allocated.length > 0).then(() => {
      const shippingOptionId = resolveDigitalShippingOptionStep({ order })
      const fulfillmentInput = transform({ order, claim, lines, shippingOptionId }, (data) => ({
        order_id: data.order.id,
        shipping_option_id: data.shippingOptionId,
        items: data.claim.allocated.map((a) => ({
          id: a.line_item_id,
          quantity: data.lines.find((l) => l.line_item_id === a.line_item_id)!.quantity,
        })),
      }))
      createOrderFulfillmentWorkflow.runAsStep({ input: fulfillmentInput })

      const codeIds = transform({ claim }, ({ claim }) => claim.allocated.flatMap((a) => a.code_ids))
      markEvoucherCodesDeliveredStep({ code_ids: codeIds, email: order.email })

      const notifications = buildEvoucherDeliveredNotificationsStep({
        order,
        lines,
        allocated: claim.allocated,
      })
      sendNotificationsStep(notifications).config({ name: "send-evoucher-delivered-notifications" })
    })

    return new WorkflowResponse(claim)
  }
)
