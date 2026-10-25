import { describe, expect, it, vi } from "vitest"

import {
  SEARCH_PRICE_CURRENCIES,
  indexedCurrency,
  priceAttribute,
} from "./search-client"

// search-client สร้าง adapter จาก sdk ตอน import — mock (vi.mock ถูก hoist ขึ้นก่อน import)
// เพื่อทดสอบเฉพาะ logic สกุลเงิน
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: vi.fn() } } }))

// CORE-9 (spec 01 กฎข้อ 15, AC-26): index เก็บราคาเฉพาะ THB — region Thailand อ่าน field _thb
describe("search price currencies (CORE-9)", () => {
  it("SEARCH_PRICE_CURRENCIES เป็น ['thb']", () => {
    expect(SEARCH_PRICE_CURRENCIES).toEqual(["thb"])
  })

  it('indexedCurrency("THB") === "thb"', () => {
    expect(indexedCurrency("THB")).toBe("thb")
  })

  it("priceAttribute ของ region THB ชี้ field _thb", () => {
    expect(priceAttribute("min_price", "thb")).toBe("min_price_thb")
  })
})
