import { beforeEach, describe, expect, it, vi } from "vitest"

import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import { INSUFFICIENT_INVENTORY_MESSAGE } from "@lib/util/insufficient-inventory"
import { UPDATE_QUANTITY_FAILED, changeLineQuantity } from "@modules/cart/components/item"

// CORE-48 (spec 01 กฎข้อ 106, AC-143): `changeLineQuantity` แปลง code ของ `updateLineItem` → ข้อความไทยที่ `product-error-message` แสดง
const updateLineItem = vi.fn()
vi.mock("@lib/data/cart", () => ({
  updateLineItem: (...a: unknown[]) => updateLineItem(...a),
  deleteLineItem: vi.fn(),
}))
vi.mock("@lib/util/cart-events", () => ({ notifyCartUpdated: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe("changeLineQuantity (กฎข้อ 106)", () => {
  it.each([
    ["INSUFFICIENT_INVENTORY", INSUFFICIENT_INVENTORY_MESSAGE],
    ["failed", UPDATE_QUANTITY_FAILED],
    ["unauthorized", SIGN_IN_AGAIN_MESSAGE],
  ])("%s → ข้อความที่ถูกต้อง", async (code, message) => {
    updateLineItem.mockResolvedValueOnce({ error: code })
    await expect(changeLineQuantity("line_1", 10)).resolves.toBe(message)
    expect(updateLineItem).toHaveBeenCalledWith({ lineId: "line_1", quantity: 10 })
  })

  it("ข้อความ stock ไม่พอเป็นคนละข้อความกับข้อความทั่วไป", () => {
    expect(INSUFFICIENT_INVENTORY_MESSAGE).not.toBe(UPDATE_QUANTITY_FAILED)
  })
})
