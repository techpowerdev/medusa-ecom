import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// CORE-4c1 (spec 01 AC-49): ข้อความ error ที่ storefront สร้างเองใน lib/data/customer.ts (server action ของ login/register/ที่อยู่)
// ESLint rule ไม่ครอบ `lib/` จึงตรวจจาก source — error ของ Medusa API (`String(error)`) แสดงตามที่ได้รับ ไม่นับ
const SOURCE = path.resolve(__dirname, "lib/data/customer.ts")
const THAI = /[฀-๿]/

const messages = () =>
  Array.from(
    fs.readFileSync(SOURCE, "utf8").matchAll(/error:\s*(["`])([^"`]*?)\1\s*[,}]/g),
    (m) => m[2]
  )

describe("ข้อความ error ของ lib/data/customer.ts (AC-49)", () => {
  it("พบข้อความครบ 3 จุด", () => {
    expect(messages()).toHaveLength(3)
  })

  it.each(messages())("%s → เป็นภาษาไทย", (message) => {
    expect(message).toMatch(THAI)
    expect(message.match(/[A-Za-z]{2,}/g)).toBeNull()
  })
})
