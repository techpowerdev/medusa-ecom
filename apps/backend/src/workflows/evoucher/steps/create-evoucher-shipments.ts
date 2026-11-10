import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { createOrderShipmentWorkflow } from "@medusajs/medusa/core-flows"
import { shortError } from "./send-evoucher-delivered-notification"

type Fulfillment = {
  id: string
  shipped_at?: Date | string | null
  canceled_at?: Date | string | null
  items?: ({ line_item_id?: string | null; quantity: number } | null)[] | null
}

export type CreateEvoucherShipmentsInput = {
  order_id: string
  /** line item ของ code ชุดที่ส่งอีเมล */
  line_item_ids: string[]
  /** ผลการส่งอีเมล code — false → ไม่สร้าง shipment (กฎข้อ 33e) */
  sent: boolean
}

/**
 * EV-17 (spec 02 กฎข้อ 33c–e, Q14 = ก): อีเมล code ส่งสำเร็จ → สร้าง shipment แบบ `no_notification` ของ fulfillment ที่ยังไม่ shipped/
 * ไม่ถูกยกเลิกและมี line ของ code ชุดนั้น — Medusa จึงไม่ยอมยกเลิก fulfillment ที่คืน stock ของ code ที่ส่งมอบแล้ว
 * **ไม่ throw**: เรียก `.run` แยก (ไม่ใช่ `runAsStep`) ล้มแล้ว log error เพื่อไม่ให้ allocation compensate ยกเลิก fulfillment
 * และปล่อย code ที่ลูกค้าได้รับอีเมลแล้ว; fulfillment ที่ shipped แล้วข้าม (resend ซ้ำไม่สร้างซ้ำ)
 */
export const createEvoucherShipments = async (
  input: CreateEvoucherShipmentsInput,
  { container }: { container: MedusaContainer }
) => {
  const shipped: string[] = []
  if (!input.sent || !input.line_item_ids.length) {
    return new StepResponse({ shipped })
  }
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const lineItemIds = new Set(input.line_item_ids)

  let fulfillments: Fulfillment[]
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
        "fulfillments.items.line_item_id",
        "fulfillments.items.quantity",
      ],
      filters: { id: input.order_id },
    })
    fulfillments = ((data[0]?.fulfillments ?? []) as (Fulfillment | null)[]).filter((f): f is Fulfillment => !!f)
  } catch (error) {
    logger.error(`evoucher: reading fulfillments of order ${input.order_id} to ship delivered codes failed: ${shortError(error)}`)
    return new StepResponse({ shipped })
  }

  for (const fulfillment of fulfillments) {
    const items = new Map<string, number>()
    for (const item of fulfillment.items ?? []) {
      if (item?.line_item_id && !items.has(item.line_item_id)) {
        items.set(item.line_item_id, item.quantity)
      }
    }
    if (fulfillment.shipped_at || fulfillment.canceled_at || ![...items.keys()].some((id) => lineItemIds.has(id))) {
      continue
    }
    try {
      await createOrderShipmentWorkflow(container).run({
        input: {
          order_id: input.order_id,
          fulfillment_id: fulfillment.id,
          items: [...items].map(([id, quantity]) => ({ id, quantity })),
          // shipment-created.ts ข้ามอีเมลจัดส่ง — ลูกค้าได้อีเมล code แล้ว
          no_notification: true,
        },
      })
      shipped.push(fulfillment.id)
    } catch (error) {
      logger.error(
        `evoucher: creating the shipment of fulfillment ${fulfillment.id} for order ${input.order_id} failed: ${shortError(error)} — ` +
          `the fulfillment can still be canceled; the next successful resend (EV-5b) ships it`
      )
    }
  }
  return new StepResponse({ shipped })
}

export const createEvoucherShipmentsStep = createStep("create-evoucher-shipments", createEvoucherShipments)
