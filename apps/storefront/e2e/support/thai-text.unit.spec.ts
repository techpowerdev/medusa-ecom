import { expect, test } from "@playwright/test"

import { latinWordsOutsideAllowList } from "./thai-text"

// CORE-4b (ADR-014 ข้อ 4): คำละตินที่ยอมให้มีในข้อความไทย = ชื่อแบรนด์/ชื่อเฉพาะ เท่านั้น
test.describe("latinWordsOutsideAllowList", () => {
  test("ข้อความไทยล้วน ตัวเลข และสัญลักษณ์ → ไม่มีคำละติน", () => {
    expect(latinWordsOutsideAllowList("ตะกร้า (0)")).toEqual([])
    expect(latinWordsOutsideAllowList("฿1,000 · 5 x")).toEqual([])
  })

  test("ชื่อแบรนด์ที่ยกเว้นไม่นับ", () => {
    expect(latinWordsOutsideAllowList("© 2026 Medusa Store สงวนลิขสิทธิ์")).toEqual([])
    expect(latinWordsOutsideAllowList("ขับเคลื่อนโดย Medusa และ Next.js")).toEqual([])
    expect(latinWordsOutsideAllowList("ดูบน GitHub")).toEqual([])
  })

  test("คำอังกฤษอื่นถูกรายงาน", () => {
    expect(latinWordsOutsideAllowList("Cart (0)")).toEqual(["Cart"])
    expect(latinWordsOutsideAllowList("บัญชี Account")).toEqual(["Account"])
    expect(latinWordsOutsideAllowList("Medusa Storefront")).toEqual(["Storefront"])
    // จุดในชื่อแบรนด์ต้องตรงตัว ไม่ใช่ wildcard ของ regex
    expect(latinWordsOutsideAllowList("Nextxjs")).toEqual(["Nextxjs"])
  })
})
