import { expect, test } from "@playwright/test"

import { latinWordsOutsideAllowList } from "./thai-text"

// CORE-4b (ADR-014 ข้อ 4): คำละตินที่ยอมให้มีในข้อความไทย = ชื่อแบรนด์/ชื่อเฉพาะ เท่านั้น
test.describe("latinWordsOutsideAllowList", () => {
  test("ข้อความไทยล้วน ตัวเลข และสัญลักษณ์ → ไม่มีคำละติน", () => {
    expect(latinWordsOutsideAllowList("ตะกร้า (0)")).toEqual([])
    expect(latinWordsOutsideAllowList("฿1,000 · 5 x")).toEqual([])
  })

  test("CORE-18: ชื่อ starter ไม่ได้รับยกเว้น", () => {
    expect(latinWordsOutsideAllowList("© 2026 Medusa Store สงวนลิขสิทธิ์")).toEqual(["Medusa", "Store"])
    expect(latinWordsOutsideAllowList("ดูบน GitHub")).toEqual(["GitHub"])
  })

  test("คำอังกฤษอื่นถูกรายงาน", () => {
    expect(latinWordsOutsideAllowList("Cart (0)")).toEqual(["Cart"])
    expect(latinWordsOutsideAllowList("บัญชี Account")).toEqual(["Account"])
  })
})
