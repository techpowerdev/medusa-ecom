import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

// CORE-16 (owner 2026-10-26): StorePostReturnsReqSchema ของ Medusa 2.22.1 รับฟิลด์เหล่านี้แล้ว
// createAndCompleteReturnOrderWorkflow ใช้ตรงๆ — `return_shipping.price` แทนราคาของ option, `receive_now` รับของคืนทันที,
// `location_id` แทน stock location ของ option → store ห้ามส่ง (ราคา/location มาจาก return option, admin เป็นผู้รับของ)
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

// body/return_shipping ที่ไม่ใช่ object (string, number, null) → ไม่มีฟิลด์ต้องห้าม; ให้ validator ของ core ตอบ 400 เอง
// (ไม่ใช้ `in` กับค่าที่ไม่ใช่ object ซึ่งจะ throw TypeError → 500 ไม่ว่าลำดับ middleware เป็นอย่างไร)
export function storeReturnOverrides(body: unknown): string[] {
  if (!isObject(body)) {
    return []
  }
  const shipping = body.return_shipping
  return [
    ["return_shipping.price", isObject(shipping) && "price" in shipping],
    ["receive_now", "receive_now" in body],
    ["location_id", "location_id" in body],
  ]
    .filter(([, present]) => present)
    .map(([field]) => field as string)
}

// อ่าน req.body ดิบ จึงไม่ขึ้นกับลำดับเทียบกับ validateAndTransformBody ของ core
export function rejectStoreReturnOverrides(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const fields = storeReturnOverrides(req.body)
  if (fields.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Fields not allowed on store returns: ${fields.join(", ")}`)
  }
  next()
}
