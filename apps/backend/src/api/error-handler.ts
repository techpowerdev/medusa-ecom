import { errorHandler, type MedusaErrorHandlerFunction } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROMOTION_NOT_COMBINABLE } from "../lib/promotion-exclusivity"
import { EVOUCHER_CODE_NOT_AVAILABLE, EVOUCHER_CODE_RESERVED } from "../modules/evoucher/errors"
import { FLASH_LIMIT_EXCEEDED, FLASH_SOLD_OUT } from "../modules/flash_sale/errors"
import { GB_CONFLICT_CODES } from "../modules/group_buy/errors"

// PROMO-2 (spec 03 กฎข้อ 13): errorHandler ของ Medusa 2.22.1 เขียนทับ code/message ของ CONFLICT เป็น
// `invalid_state_error` + ข้อความกลาง → error ที่มี code ใน allow-list นี้ตอบ 409 { type: "conflict", code, message } เอง
// อ่าน code/message จาก property ตรงๆ (ไม่ใช้ instanceof) เพราะ workflow engine ส่ง error ที่ผ่าน serializeError
// (object ธรรมดาที่คง type/code/message) — task ใหม่ที่มี code 409 ของตัวเอง (เช่น `GB_*`) เพิ่ม code ที่นี่
export const BUSINESS_CONFLICT_CODES: ReadonlySet<string> = new Set([
  PROMOTION_NOT_COMBINABLE,
  FLASH_LIMIT_EXCEEDED,
  FLASH_SOLD_OUT,
  EVOUCHER_CODE_NOT_AVAILABLE,
  EVOUCHER_CODE_RESERVED,
  ...GB_CONFLICT_CODES,
])

const medusaErrorHandler = errorHandler()

export const businessErrorHandler: MedusaErrorHandlerFunction = (error, req, res, next) => {
  const code = error?.code
  if (typeof code !== "string" || !BUSINESS_CONFLICT_CODES.has(code)) {
    return medusaErrorHandler(error, req, res, next)
  }

  req.scope?.resolve(ContainerRegistrationKeys.LOGGER).info(`${code}: ${error.message}`)
  res.status(409).json({ type: "conflict", code, message: error.message })
}
