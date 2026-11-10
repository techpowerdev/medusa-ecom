import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger, RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

// CORE-55 (spec 01 กฎข้อ 113, ADR-022): createAndCompleteReturnOrderWorkflow ของ Medusa 2.22.1 เติม location จาก
// return option ให้เฉพาะ fulfillment (create-complete-return.js:82-93) แต่สร้าง return ด้วย input.location_id (:268)
// → return จากหน้าเว็บมี location_id null และ admin รับของไม่ได้ ตั้ง location ของ option ลง req.validatedBody
// (route ของ core ส่งค่านี้เข้า workflow ตรงๆ) — client ยังส่ง location_id ไม่ได้ (CORE-16); ถ้า upstream แก้แล้วให้ลบไฟล์นี้
export const RETURN_ITEM_NOT_STOCKED_MESSAGE = "This item cannot be returned online"
// กฎข้อ 37: ข้อความคงที่ ไม่ต่อ id จาก input
const NO_LOCATION_MESSAGE = "Return shipping option has no stock location"

type ReturnBody = {
  order_id: string
  items: { id: string }[]
  return_shipping: { option_id: string }
  location_id?: string
}
type OrderLine = {
  id: string
  variant?: {
    manage_inventory?: boolean | null
    inventory_items?: ({ inventory?: { location_levels?: ({ location_id?: string } | null)[] | null } | null } | null)[] | null
  } | null
}

// fail-closed: line ที่หาไม่เจอใน order ถือว่าไม่ผ่าน (ปกติ CORE-20b ตอบ 400 ไปก่อนแล้ว)
const isStockedAt = (line: OrderLine | undefined, locationId: string) =>
  !!line &&
  (!line.variant?.manage_inventory ||
    (line.variant.inventory_items ?? []).some((ii) =>
      (ii?.inventory?.location_levels ?? []).some((level) => level?.location_id === locationId)
    ))

// ตัวสุดท้ายของ chain: ผ่าน auth + ownership (CORE-13), override (CORE-16), option (CORE-17/21) และช่วงคืน (CORE-20b) แล้ว
// อ่านจาก req.validatedBody (ผลของ validateAndTransformBody ของ core ซึ่งทำงานก่อน — ADR-022) ไม่อ่าน req.body.location_id
export async function assignStoreReturnLocation(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const body = req.validatedBody as ReturnBody | undefined
  if (!body) {
    // ลำดับ middleware ของ core เปลี่ยน → ล้มชัดเจน ไม่ปล่อยให้ return ถูกสร้างโดยไม่มี location
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Return request was not validated")
  }

  const query = req.scope.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "service_zone.fulfillment_set.location.id"],
    filters: { id: body.return_shipping.option_id },
  })
  const locationId = options[0]?.service_zone?.fulfillment_set?.location?.id
  if (!locationId) {
    // 113b: CORE-21 และ core ปฏิเสธก่อนแล้ว — กันกรณี location ถูกถอดระหว่าง request
    throw new MedusaError(MedusaError.Types.INVALID_DATA, NO_LOCATION_MESSAGE)
  }

  // 113c: ตรวจต่อ line ตอนขอคืน (core ตรวจตอน confirm และผ่านเมื่อ line ใด line หนึ่งมี level)
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "items.id", "items.variant.manage_inventory", "items.variant.inventory_items.inventory.location_levels.location_id"],
    filters: { id: body.order_id },
  })
  const lines = (orders[0]?.items ?? []) as OrderLine[]
  const unstocked = body.items.some((item) => !isStockedAt(lines.find((l) => l?.id === item.id), locationId))
  if (unstocked) {
    req.scope
      .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      .warn(`Store return rejected: no inventory level for order ${body.order_id} at location ${locationId}`)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, RETURN_ITEM_NOT_STOCKED_MESSAGE)
  }

  body.location_id = locationId
  next()
}
