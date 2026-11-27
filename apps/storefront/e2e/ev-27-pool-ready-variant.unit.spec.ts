import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// EV-27 (spec 02 กฎข้อ 43g, AC-59 static): e2e ที่เปิดฟอร์ม Create pool บนหน้า variant ใช้ variant ที่ผ่านเงื่อนไขจาก helper ร่วม
// `createPoolReadyVariant` (e2e/support/evoucher.ts) — ไม่สร้าง product ธรรมดา (manage_inventory ค่าเริ่มต้น false) เอง
const read = (name: string) => fs.readFileSync(path.join(__dirname, name), "utf8")
const FORM_SPECS = [
  "admin-form-pilot.spec.ts",
  "admin-create-double-submit.spec.ts",
  "admin-modal-return-focus.spec.ts",
  "evoucher-admin-forms.spec.ts",
  "evoucher-admin-pool-prerequisites.spec.ts",
]
const IMPORTS_HELPER = /import\s*\{[^}]*\bcreatePoolReadyVariant\b[^}]*\}\s*from\s*"\.\/support\/evoucher"/
// fixture เดิมของฟอร์ม Create pool: product ที่มี variant "500 THB" แต่ไม่ได้ตั้ง manage_inventory
const PLAIN_VOUCHER_PRODUCT = /variants:\s*\[\{\s*title:\s*"500 THB",\s*options:\s*\{\s*Value:\s*"500"\s*\},\s*prices:/

for (const name of FORM_SPECS) {
  test(`AC-59: ${name} import createPoolReadyVariant และไม่สร้าง variant voucher ธรรมดาเอง`, () => {
    const source = read(name)
    expect(source).toMatch(IMPORTS_HELPER)
    expect(source).not.toMatch(PLAIN_VOUCHER_PRODUCT)
  })
}

test("AC-59: support/evoucher.ts export createPoolReadyVariant และ createVoucher ใช้ helper นี้", () => {
  const support = read("support/evoucher.ts")
  expect(support).toMatch(/export\s+async function\s+createPoolReadyVariant\b/)
  const createVoucher = support.slice(support.indexOf("export async function createVoucher"))
  expect(createVoucher.slice(0, createVoucher.indexOf("\n}\n"))).toContain("createPoolReadyVariant(")
})
