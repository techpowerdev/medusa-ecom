import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { normalize } from "@lib/util/checkout-error"
import { trimInvisible } from "@lib/util/trim-invisible"

// CORE-58 (spec 01 กฎข้อ 116, AC-157): (a) ช่องที่อยู่ที่มีแต่ white space/zero-width ถือว่าว่าง — ตัดเฉพาะหัว/ท้าย
// (b) `normalize` ของข้อความ error เหลือที่เดียว (รวม `.trim()` ของ group-join-error)
describe("trimInvisible (กฎข้อ 116a)", () => {
  it.each([
    ["​", ""],
    [" ​﻿ ", ""],
    ["⁠", ""],
    ["‌‍", ""],
    ["​วัฒนา​", "วัฒนา"],
    ["  วัฒนา ", "วัฒนา"],
    ["วัฒ​นา", "วัฒ​นา"],
  ])("%j → %j", (input, expected) => {
    expect(trimInvisible(input)).toBe(expected)
  })
})

describe("normalize ตัวกลาง (กฎข้อ 116b)", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, "lib/util", file), "utf8")

  it.each(["insufficient-inventory.ts", "group-join-error.ts"])("%s ไม่ประกาศ normalize เอง", (file) => {
    const source = read(file)
    expect(source).not.toContain("const normalize =")
    expect(source).toMatch(/import \{[^}]*\bnormalize\b[^}]*\} from "\.\/checkout-error"/)
  })

  it("ตัด white space หัว/ท้าย และ . ท้ายข้อความ แล้วเป็นตัวเล็ก", () => {
    expect(normalize("  The cart has no items. ")).toBe("the cart has no items")
  })
})
