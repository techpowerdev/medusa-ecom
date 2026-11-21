import { errorHandler, type MedusaErrorHandlerFunction } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PROMOTION_NOT_COMBINABLE } from "../lib/promotion-exclusivity"
import { AFFILIATE_STATUS_CHANGED } from "../modules/affiliate/errors"
import {
  EVOUCHER_CODE_NOT_AVAILABLE,
  EVOUCHER_CODE_RESERVED,
  EVOUCHER_RESEND_IN_PROGRESS,
} from "../modules/evoucher/errors"
import { FLASH_LIMIT_EXCEEDED, FLASH_SOLD_OUT } from "../modules/flash_sale/errors"
import { GB_CONFLICT_CODES } from "../modules/group_buy/errors"
import { CART_COMPLETION_IN_PROGRESS, CART_COMPLETION_IN_PROGRESS_MESSAGE } from "./store/carts/errors"
import { PAYMENT_ALREADY_COMPLETED, PAYMENT_COLLECTION_RESET } from "./store/payment-collections/errors"

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
  EVOUCHER_RESEND_IN_PROGRESS, // EV-5b
  ...GB_CONFLICT_CODES,
  PAYMENT_ALREADY_COMPLETED, // PAY-6 (spec 06 กฎข้อ 7A)
  PAYMENT_COLLECTION_RESET, // PAY-9 (spec 06 กฎข้อ 11)
  AFFILIATE_STATUS_CHANGED, // AF-15 (spec 05 กฎ 39b)
  CART_COMPLETION_IN_PROGRESS, // CORE-76 (spec 01 กฎข้อ 134 a2) — Medusa ไม่ใส่ code ให้ จึงจับจากข้อความ (codeOf)
])

// CORE-76: CONFLICT ไม่มี code ของ route complete ของ Medusa → code ของเรา (ข้อความคงที่ — contract test กับ source ของ Medusa)
const codeOf = (error: { code?: unknown; type?: unknown; message?: unknown } | undefined) =>
  error?.code === undefined &&
  error?.type === MedusaError.Types.CONFLICT &&
  error?.message === CART_COMPLETION_IN_PROGRESS_MESSAGE
    ? CART_COMPLETION_IN_PROGRESS
    : error?.code

const medusaErrorHandler = errorHandler()

export const businessErrorHandler: MedusaErrorHandlerFunction = (error, req, res, next) => {
  const code = codeOf(error)
  if (typeof code !== "string" || !BUSINESS_CONFLICT_CODES.has(code)) {
    return medusaErrorHandler(error, req, res, next)
  }

  req.scope?.resolve(ContainerRegistrationKeys.LOGGER).info(`${code}: ${error.message}`)
  res.status(409).json({ type: "conflict", code, message: error.message })
}
