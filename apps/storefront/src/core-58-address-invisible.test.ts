import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { trimInvisible } from "@lib/util/trim-invisible"

// CORE-58 (spec 01 กฎข้อ 116, AC-157): (a) ช่องที่อยู่ที่มีแต่ white space/zero-width ถือว่าว่าง — ตัดเฉพาะหัว/ท้าย
// (b) `normalize` ของข้อความ error เหลือที่เดียว — CORE-84 (กฎข้อ 140) ย้ายผู้ใช้ตัวสุดท้ายไปใช้ code แล้วลบ normalize
describe("trimInvisible (กฎข้อ 116a)", () => {
  it.each([
    ["\u200B", ""],
    [" \u200B\uFEFF ", ""],
    ["\u2060", ""],
    ["\u200C\u200D", ""],
    ["\u200Bวัฒนา\u200B", "วัฒนา"],
    ["  วัฒนา ", "วัฒนา"],
    ["วัฒ\u200Bนา", "วัฒ\u200Bนา"],
  ])("%j → %j", (input, expected) => {
    expect(trimInvisible(input)).toBe(expected)
  })
})

describe("normalize ตัวกลาง (กฎข้อ 116b) — ลบแล้วใน CORE-84", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, "lib/util", file), "utf8")

  // CORE-82/84 (กฎข้อ 140): insufficient-inventory.ts และ group-join-error.ts ตัดสินจาก code แล้ว ไม่เทียบข้อความ
  it.each(["group-join-error.ts", "checkout-error.ts", "insufficient-inventory.ts"])("%s ไม่มี normalize", (file) => {
    expect(read(file)).not.toMatch(/\bnormalize\b/)
  })
})
