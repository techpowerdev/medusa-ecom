import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

// CORE-16 (owner 2026-10-26): StorePostReturnsReqSchema ของ Medusa 2.22.1 รับฟิลด์เหล่านี้แล้ว
// createAndCompleteReturnOrderWorkflow ใช้ตรงๆ — `return_shipping.price` แทนราคาของ option, `receive_now` รับของคืนทันที,
// `location_id` แทน stock location ของ option → store ห้ามส่ง (ราคา/location มาจาก return option, admin เป็นผู้รับของ)
type Body = Record<string, unknown>

export function storeReturnOverrides(body: unknown): string[] {
  const b = (body ?? {}) as Body
  const shipping = (b.return_shipping ?? {}) as Body
  return [
    ["return_shipping.price", "price" in shipping],
    ["receive_now", "receive_now" in b],
    ["location_id", "location_id" in b],
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
