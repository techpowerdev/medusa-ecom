import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// EV-26 (spec 02 กฎข้อ 42b, AC-56 static): helper ของ e2e admin e-voucher ที่เคยซ้ำสองไฟล์ย้ายไป e2e/support/evoucher.ts
const read = (name: string) => fs.readFileSync(path.join(__dirname, name), "utf8")
const SPECS = {
  "evoucher-admin-backordered.spec.ts": ["overstock", "flaggedVariants"],
  "evoucher-admin-retry-allocation.spec.ts": ["setStock", "flaggedLines"],
}
const IMPORTS_SHARED = /import\s*\{[^}]*\bsetVariantStock\b[^}]*\}\s*from\s*"\.\/support\/evoucher"/
const IMPORTS_ITEMS = /import\s*\{[^}]*\bbackorderedItems\b[^}]*\}\s*from\s*"\.\/support\/evoucher"/

for (const [name, removed] of Object.entries(SPECS)) {
  const names = removed.join("/")
  test(`AC-56: ${name} ไม่นิยาม ${names} เอง และ import setVariantStock + backorderedItems จาก support`, () => {
    const source = read(name)
    for (const helper of removed) {
      expect(source, `${name} ยังนิยาม ${helper}`).not.toMatch(new RegExp(`\\b(?:const|function)\\s+${helper}\\b`))
    }
    expect(source).toMatch(IMPORTS_SHARED)
    expect(source).toMatch(IMPORTS_ITEMS)
  })
}

test("AC-56: support/evoucher.ts export setVariantStock + backorderedItems และไม่ export ชื่อ setStock (ชนกับ support/group-buy.ts)", () => {
  const support = read("support/evoucher.ts")
  expect(support).toMatch(/export\s+(?:const|async function)\s+setVariantStock\b/)
  expect(support).toMatch(/export\s+(?:const|async function)\s+backorderedItems\b/)
  expect(support).not.toMatch(/export\s+(?:const|let|async function|function)\s+setStock\b/)
  expect(support).not.toMatch(/export\s*\{[^}]*\bsetStock\b/)
})
