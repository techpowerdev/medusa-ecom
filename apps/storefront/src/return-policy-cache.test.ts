import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// CORE-20c (spec 01 กฎข้อ 60, AC-96 ส่วน grep): สถานะ return และ return_window_days ที่ admin แก้ต้องเห็นโดยไม่ค้าง cache
// — `listOrders` และการอ่าน region ของหน้า /returns + structured data ไม่ใช้ `force-cache`
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), "utf8")

/** source ของ `export const <name>` ถึง export ถัดไป */
const exported = (source: string, name: string) => {
  const start = source.indexOf(`export const ${name} `)
  expect(start, `export const ${name}`).toBeGreaterThanOrEqual(0)
  const next = source.indexOf("\nexport ", start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

describe("ไม่ force-cache ข้อมูลที่ return ขึ้นกับ (กฎข้อ 60)", () => {
  it("listOrders ไม่ใช้ force-cache", () => {
    expect(exported(read("lib/data/orders.ts"), "listOrders")).not.toContain("force-cache")
  })

  it("listRegionsUncached ไม่ใช้ force-cache", () => {
    expect(exported(read("lib/data/regions.ts"), "listRegionsUncached")).not.toContain("force-cache")
  })

  it.each([
    "lib/data/store-policies.ts",
    "app/[countryCode]/(main)/page.tsx",
    "app/[countryCode]/(main)/products/[handle]/page.tsx",
  ])("%s อ่าน policy ของ region ผ่าน listRegionsUncached", (file) => {
    expect(read(file)).toContain("listRegionsUncached()")
  })

  it("หน้า /returns อ่าน policy ผ่าน getStorePolicies (ไม่เรียก listRegions แบบ cache เอง)", () => {
    const source = read("app/[countryCode]/(main)/returns/page.tsx")
    expect(source).toContain("getStorePolicies(")
    expect(source).not.toMatch(/listRegions\(|force-cache/)
    expect(read("lib/data/store-policies.ts")).not.toMatch(/listRegions\(|force-cache/)
  })

  it("structured data ของหน้าแรกสร้างจาก region ที่ไม่ cache", () => {
    expect(read("app/[countryCode]/(main)/page.tsx")).toMatch(
      /buildRegionsReturnPolicies\(\s*await listRegionsUncached\(\)\s*\)/
    )
  })
})
