import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows"

// EV-15 (spec 02 กฎข้อ 31, ADR-021): Medusa 2.22.1 ไม่ลบ shipping method เมื่อ cart เหลือ method เดียว
// (shouldCleanupOrphanProfiles) → cart ที่เหลือแต่ line requires_shipping=false ยังเสียค่าส่ง
// createHook มี handler ได้ตัวเดียว งานอื่นที่ใช้ hook นี้ต้องรวม handler ที่ไฟล์นี้

const DIGITAL_OPTION_TYPE_CODE = "digital-delivery"

refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection(
  async ({ input }, { container }) => {
    // refresh ที่มาจาก addShippingMethodToCartWorkflow ต้องไม่ลบ method ที่เพิ่งเพิ่ม (กฎข้อ 31b)
    if (input.shipping_methods?.length) {
      return new StepResponse(undefined, [] as string[])
    }

    // input.items เป็น undefined ตอน DELETE line จึงต้อง query cart เอง
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: ["id", "items.requires_shipping", "shipping_methods.id", "shipping_methods.shipping_option_id"],
      filters: { id: input.cart_id },
    })
    const items = cart?.items ?? []
    const methods = (cart?.shipping_methods ?? []).filter((m) => !!m)
    if (!items.length || items.some((item) => item?.requires_shipping) || !methods.length) {
      return new StepResponse(undefined, [] as string[])
    }

    const optionIds = methods.map((m) => m.shipping_option_id).filter((id): id is string => !!id)
    const { data: options } = optionIds.length
      ? await query.graph({
          entity: "shipping_option",
          fields: ["id", "type.code"],
          filters: { id: optionIds },
        })
      : { data: [] }
    const digitalOptionIds = new Set(
      options.filter((o) => o.type?.code === DIGITAL_OPTION_TYPE_CODE).map((o) => o.id)
    )

    const orphanIds = methods
      .filter((m) => !m.shipping_option_id || !digitalOptionIds.has(m.shipping_option_id))
      .map((m) => m.id)
    if (!orphanIds.length) {
      return new StepResponse(undefined, [] as string[])
    }

    await container.resolve(Modules.CART).softDeleteShippingMethods(orphanIds)
    return new StepResponse(undefined, orphanIds)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    await container.resolve(Modules.CART).restoreShippingMethods(ids)
  }
)
