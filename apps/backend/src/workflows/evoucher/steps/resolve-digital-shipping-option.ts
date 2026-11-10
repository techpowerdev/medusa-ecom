import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { EvoucherOrder } from "./evoucher-order"

// spec 02 กฎข้อ 8: หา option Digital delivery ด้วย type.code ไม่ใช่ชื่อ
const DIGITAL_OPTION_TYPE_CODE = "digital-delivery"

// fulfillment ผ่าน provider digital (ADR-006): ระบุ option เอง ไม่พึ่ง shipping_methods[0] ของ order
export const resolveDigitalShippingOptionStep = createStep(
  "resolve-digital-shipping-option",
  async (input: { order: EvoucherOrder }, { container }) => {
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
