import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it } from "vitest"

import {
  INSUFFICIENT_INVENTORY_MESSAGE,
  isInsufficientInventory,
} from "@lib/util/insufficient-inventory"

// CORE-48 (spec 01 กฎข้อ 106, AC-143): 400 `not_allowed` / `insufficient_inventory` ของ Medusa 2.22.1
// (`confirm-inventory.js` ของ core-flows) — FetchError ของ js-sdk เก็บแค่ message/status จึงจับคู่ทั้ง code และข้อความคงที่
const MESSAGE = "Some variant does not have the required inventory"

describe("isInsufficientInventory (กฎข้อ 106a)", () => {
  it.each([
    ["400 ข้อความของ Medusa", { status: 400, message: MESSAGE }],
    ["มี . ท้าย", { status: 400, message: `${MESSAGE}.` }],
    ["ตัวพิมพ์ต่าง", { status: 400, message: MESSAGE.toUpperCase() }],
    ["code insufficient_inventory", { status: 400, code: "insufficient_inventory", message: "x" }],
    ["FetchError ของ js-sdk", new FetchError(MESSAGE, "Bad Request", 400)],
  ])("%s → true", (_label, error) => {
    expect(isInsufficientInventory(error)).toBe(true)
  })

  it.each([
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
