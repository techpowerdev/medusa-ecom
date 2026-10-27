import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { errorHandler as medusaErrorHandler } from "@medusajs/framework/http"
import { MedusaError, serializeError } from "@medusajs/framework/utils"
import { BUSINESS_CONFLICT_CODES, businessErrorHandler } from "../error-handler"

// PROMO-2 (spec 03 กฎข้อ 13, AC-12): code ธุรกิจของเรา → 409 { type: "conflict", code, message }
// error อื่นต้องได้ผลเหมือน errorHandler เดิมของ Medusa ทุกอย่าง (ใช้ handler ของ Medusa เป็นตัวเทียบ)
type Sent = { status?: number; body?: unknown }

const run = (handler: (...args: any[]) => unknown, error: unknown): Sent => {
  const sent: Sent = {}
  const res = {
    status(code: number) {
      sent.status = code
      return res
    },
    json(body: unknown) {
      sent.body = body
      return res
    },
  }
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  const req = { path: "/test", scope: { resolve: () => logger } }
  handler(error, req, res, jest.fn())
  return sent
}

const medusa = medusaErrorHandler()

describe("businessErrorHandler", () => {
  it("covers our 409 codes (spec 03 PROMOTION_NOT_COMBINABLE, FLASH_*; spec 02 void + reserved + resend lock; spec 04 GB_*; spec 06 PAY-6)", () => {
    expect([...BUSINESS_CONFLICT_CODES].sort()).toEqual(
      [
        "EVOUCHER_CODE_NOT_AVAILABLE",
        "EVOUCHER_CODE_RESERVED",
        "EVOUCHER_RESEND_IN_PROGRESS",
        "FLASH_LIMIT_EXCEEDED",
        "FLASH_SOLD_OUT",
        "PAYMENT_ALREADY_COMPLETED",
        "PROMOTION_NOT_COMBINABLE",
        "GB_ALREADY_IN_OTHER_GROUP",
        "GB_GROUP_FULL",
        "GB_MAX_TOTAL_ORDERS_REACHED",
        "GB_UNITS_LIMIT_EXCEEDED",
        "GB_ITEMS_NOT_ELIGIBLE",
        "GB_CART_ALREADY_JOINED",
      ].sort()
    )
    // spec 04 กฎข้อ 5: GB_DISCOUNT_NOT_APPLIED เป็น 400 not_allowed ไม่ใช่ 409
    expect(BUSINESS_CONFLICT_CODES.has("GB_DISCOUNT_NOT_APPLIED")).toBe(false)
    expect(BUSINESS_CONFLICT_CODES.has("GB_CART_NOT_COMPLETABLE")).toBe(false) // กฎข้อ 14a: 400
  })

  // AC-12 (d): route ของเราไม่ตอบ 409 เอง — ใช้ errorHandler กลางเท่านั้น
  it("no route under src/api answers 409 by itself", () => {
    const routeFiles = (readdirSync(join(__dirname, ".."), { recursive: true }) as string[])
      .filter((f) => /(^|\/)route\.ts$/.test(f))
      .map((f) => join(__dirname, "..", f))
    expect(routeFiles.length).toBeGreaterThan(0)

    const offenders = routeFiles.filter((f) => /status\(\s*409\s*\)/.test(readFileSync(f, "utf8")))
    expect(offenders).toEqual([])
  })

  it.each([...BUSINESS_CONFLICT_CODES])("answers %s as 409 conflict with our code and message", (code) => {
    const error = new MedusaError(MedusaError.Types.CONFLICT, `message for ${code}`, code)

    expect(run(businessErrorHandler, error)).toEqual({
      status: 409,
      body: { type: "conflict", code, message: `message for ${code}` },
    })
  })

  it("decides by our code, not by the error type", () => {
    const error = new MedusaError(MedusaError.Types.NOT_ALLOWED, "limit", "FLASH_LIMIT_EXCEEDED")

    expect(run(businessErrorHandler, error)).toEqual({
      status: 409,
      body: { type: "conflict", code: "FLASH_LIMIT_EXCEEDED", message: "limit" },
    })
  })

  it("keeps the code after the workflow engine serialized the error (plain object, not MedusaError)", () => {
    const error = serializeError(
      new MedusaError(MedusaError.Types.CONFLICT, "This flash sale is sold out", "FLASH_SOLD_OUT")
    )
    expect(error).not.toBeInstanceOf(MedusaError)

    expect(run(businessErrorHandler, error)).toEqual({
      status: 409,
      body: { type: "conflict", code: "FLASH_SOLD_OUT", message: "This flash sale is sold out" },
    })
  })

  describe("errors that are not ours → same response as Medusa's errorHandler (AC-12 c)", () => {
    const zodLike = Object.assign(new Error("invalid"), {
      issues: [{ code: "invalid_type", expected: "string", received: "number", path: ["a"], message: "bad" }],
    })
    const httpError = Object.assign(new Error("request entity too large"), {
      status: 413,
      statusCode: 413,
      expose: true,
    })

    it.each([
      ["CONFLICT without code", new MedusaError(MedusaError.Types.CONFLICT, "Cart is already being completed")],
      ["CONFLICT with a code that is not ours", new MedusaError(MedusaError.Types.CONFLICT, "x", "SOMETHING_ELSE")],
      ["serialized CONFLICT without code", serializeError(new MedusaError(MedusaError.Types.CONFLICT, "x"))],
      ["NOT_FOUND", new MedusaError(MedusaError.Types.NOT_FOUND, "Cart id not found: cart_x")],
      ["INVALID_DATA", new MedusaError(MedusaError.Types.INVALID_DATA, "bad input")],
      ["NOT_ALLOWED with a code", new MedusaError(MedusaError.Types.NOT_ALLOWED, "nope", "GB_DISCOUNT_NOT_APPLIED")],
      ["UNAUTHORIZED", new MedusaError(MedusaError.Types.UNAUTHORIZED, "Unauthorized")],
      ["plain Error", new Error("boom")],
      ["zod issues", zodLike],
      ["http-errors", httpError],
    ])("%s", (_name, error) => {
      expect(run(businessErrorHandler, error)).toEqual(run(medusa, error))
    })
  })
})
