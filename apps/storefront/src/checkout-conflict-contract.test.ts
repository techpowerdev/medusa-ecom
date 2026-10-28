import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { CHECKOUT_CONFLICTS } from "@lib/util/checkout-error"

// FS-15 (spec 03 กฎข้อ 20c, AC-22): contract กับ backend — อ่าน source ของ backend ตรง (แบบ spec 01 กฎข้อ 66c)
// `FetchError` ของ js-sdk 2.22.1 ไม่เก็บ `code` → storefront จับคู่ด้วยข้อความคงที่ของ backend
// test นี้ต้องล้มเมื่อ backend เปลี่ยนข้อความ/code ของ 409 ตอน complete cart โดยไม่แก้ map ฝั่ง storefront
const BACKEND_SRC = path.resolve(__dirname, "../../backend/src")
const read = (file: string) => fs.readFileSync(path.join(BACKEND_SRC, file), "utf8")

/** ค่าของ `export const NAME = "VALUE"` */
const constants = (file: string) =>
  new Map(Array.from(read(file).matchAll(/export const (\w+) = "([^"]+)"/g), ([, n, v]) => [n, v]))

/** `new MedusaError(MedusaError.Types.CONFLICT, "<message>", CODE)` ทุกตัวในไฟล์ */
const conflicts = (file: string, names: Map<string, string>) =>
  Array.from(
    read(file).matchAll(/MedusaError\.Types\.CONFLICT,\s*"([^"]+)",\s*(\w+)\s*\)/g),
    ([, message, name]) => ({ code: names.get(name), message })
  )

// path ของ throw ใน completeCartWorkflow.hooks.validate (complete-cart-validate.ts):
// PROMO-1 assertCompletionCombinable → promotion-exclusivity.ts, FS-3 reserveFlashSaleForCart → flash_sale/service.ts
const backendCompleteConflicts = () => [
  ...conflicts("modules/flash_sale/service.ts", constants("modules/flash_sale/errors.ts")),
  ...conflicts("workflows/hooks/promotion-exclusivity.ts", constants("lib/promotion-exclusivity.ts")),
]

describe("contract: 409 ของ POST /store/carts/:id/complete (FS-3, PROMO-1)", () => {
  it("อ่านคู่ code/message จาก backend ได้ครบ 3 code", () => {
    expect(backendCompleteConflicts().map((e) => e.code).sort()).toEqual([
      "FLASH_LIMIT_EXCEEDED",
      "FLASH_SOLD_OUT",
      "PROMOTION_NOT_COMBINABLE",
    ])
  })

  it("map ของ storefront มี code และข้อความตรงกับ backend ทุกตัว", () => {
    const mapped = CHECKOUT_CONFLICTS.map(({ code, message }) => ({ code, message }))
    expect(mapped).toEqual(expect.arrayContaining(backendCompleteConflicts()))
    expect(mapped).toHaveLength(backendCompleteConflicts().length)
  })

  it("ทุก code ที่ map อยู่ใน allow-list 409 ของ error-handler (ไม่ถูกเขียนทับเป็นข้อความกลาง)", () => {
    const handler = read("api/error-handler.ts")
    for (const { code } of CHECKOUT_CONFLICTS) {
      expect(handler, code).toMatch(new RegExp(`\\b${code},`))
    }
  })
})
