import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import { MedusaApiError } from "@lib/util/medusa-api-error"
import {
  INSUFFICIENT_INVENTORY_MESSAGE,
  isInsufficientInventory,
} from "@lib/util/insufficient-inventory"

// CORE-48 (spec 01 กฎข้อ 106, AC-143): 400 `not_allowed` / `insufficient_inventory` ของ Medusa 2.22.1
// (`confirm-inventory.js` ของ core-flows) — CORE-82 (กฎข้อ 140, ADR-028): จับคู่ด้วย code ของ `MedusaApiError` เท่านั้น
const MESSAGE = "Some variant does not have the required inventory"

describe("isInsufficientInventory (กฎข้อ 106a)", () => {
  it.each([
    ["code insufficient_inventory", { status: 400, code: "insufficient_inventory", message: "x" }],
    [
      "MedusaApiError ของ medusaFetch",
      new MedusaApiError({ status: 400, type: "not_allowed", code: "insufficient_inventory", message: MESSAGE }),
    ],
  ])("%s → true", (_label, error) => {
    expect(isInsufficientInventory(error)).toBe(true)
  })

  it.each([
    ["400 ข้อความของ Medusa แต่ไม่มี code (ไม่เทียบข้อความแล้ว)", { status: 400, message: MESSAGE }],
    ["FetchError ของ js-sdk (ไม่มี code)", new FetchError(MESSAGE, "Bad Request", 400)],
    ["400 ข้อความอื่น", { status: 400, message: "Invalid request" }],
    ["500 ข้อความเดียวกัน", { status: 500, message: MESSAGE }],
    ["409 ข้อความเดียวกัน", { status: 409, message: MESSAGE }],
    ["409 code เดียวกัน", { status: 409, code: "insufficient_inventory", message: "x" }],
    ["null", null],
    ["undefined", undefined],
    ["string", MESSAGE],
  ])("%s → false", (_label, error) => {
    expect(isInsufficientInventory(error)).toBe(false)
  })
})

describe("INSUFFICIENT_INVENTORY_MESSAGE", () => {
  it("เป็นข้อความไทยตามกฎข้อ 106", () => {
    expect(INSUFFICIENT_INVENTORY_MESSAGE).toBe(
      "สินค้ามีไม่พอตามจำนวนที่เลือก กรุณาลดจำนวนแล้วลองใหม่อีกครั้ง"
    )
  })
})
