import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// CORE-14d (spec 01 กฎข้อ 57, AC-92)
describe("CORE-14d: /cart แบบ no-JS และ error ระหว่างเพิ่มลง cart หลัง login", () => {
  it("ไม่มี cart/loading.tsx — Suspense fallback ของ loading ไม่ถูกแทนที่เมื่อไม่มี JavaScript (ค้าง skeleton)", () => {
    expect(
      existsSync(path.join(__dirname, "app/[countryCode]/(main)/cart/loading.tsx"))
    ).toBe(false)
  })

  it("lib/data/customer.ts ไม่มี catch ที่กลืน error เงียบ (catch {} ว่าง)", () => {
    const source = readFileSync(path.join(__dirname, "lib/data/customer.ts"), "utf8")
    expect(source).not.toMatch(/catch\s*(\(\s*\w*\s*\))?\s*\{\s*(\/\/[^\n]*\s*)*\}/)
  })
})
