import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// CORE-4b2 (spec 01 AC-49): route handler ไม่อยู่ใต้ ESLint rule (ไม่มี JSX) จึงตรวจข้อความตอบกลับที่ผู้ใช้เห็นจาก source
// ข้อความต้องมีอักษรไทย; ตัวอักษรละตินที่เหลือได้มีแค่รูปแบบลิงก์ `/buy/{variant_id}:{quantity}`
// CORE-14: logic ของ /buy ย้ายไป `buyFromPermalink` (ใช้ร่วมกับ server action login) ข้อความจึงอยู่ใน server-cart.ts
const ROUTE = path.resolve(__dirname, "lib/util/server-cart.ts")
const THAI = /[฀-๿]/

const messages = () => {
  const source = fs.readFileSync(ROUTE, "utf8")
  return Array.from(
    source.matchAll(/error:\s*(["`])([\s\S]*?)\1/g),
    (m) => m[2]
  )
}

describe("ข้อความตอบกลับของ /buy/[items] (AC-49)", () => {
  it("พบข้อความตอบกลับครบ 4 จุด", () => {
    expect(messages()).toHaveLength(4)
  })

  it.each(messages())("%s → เป็นภาษาไทย", (message) => {
    expect(message).toMatch(THAI)
    const latin = message
      .replace("/buy/{variant_id}:{quantity}", "")
      .replace(/\$\{[^}]*\}/g, "")
      .match(/[A-Za-z]{2,}/g)
    expect(latin).toBeNull()
  })
})
