import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// FS-25 (spec 03 กฎข้อ 30, AC-32 static): helper สร้างสินค้า/แคมเปญ flash ของ e2e flash อยู่ใน `e2e/support/flash-sale.ts`
// ที่เดียว, e2e ของ FS-23 เปิด PDP ด้วย `?v_id=`, และจำนวน `expect` ของแต่ละ test/ไฟล์ไม่ลดจากก่อนย้าย
const E2E = __dirname
const read = (name: string) => fs.readFileSync(path.join(E2E, name), "utf8")

const USERS = ["fs-22-refunded-notice.spec.ts", "pay-9-refunded-cart-repay.spec.ts", "fs-24-card-race-refund.spec.ts"]
const FS23 = "fs-23-pdp-cart-aware-limit.spec.ts"

/** จำนวน `expect(`/`expect.` ก่อน FS-25 (develop 59c6af18): ทั้งไฟล์ และต่อ test ตามลำดับในไฟล์ */
const BASELINE: Record<string, { file: number; tests: number[] }> = {
  "fs-22-refunded-notice.spec.ts": { file: 10, tests: [1, 0] },
  "pay-9-refunded-cart-repay.spec.ts": { file: 20, tests: [19] },
  "fs-24-card-race-refund.spec.ts": { file: 15, tests: [12] },
  "fs-23-pdp-cart-aware-limit.spec.ts": { file: 18, tests: [5, 12] },
}
const countExpect = (code: string) => (code.match(/\bexpect[.(]/g) ?? []).length

test("AC-32: สามไฟล์ไม่สร้างสินค้า/แคมเปญ/โปรโมชัน flash เอง แต่ import จาก support/flash-sale", () => {
  for (const name of USERS) {
    const code = read(name)
    expect(code, name).toContain('from "./support/flash-sale"')
    for (const path of ["/admin/products?", "/location-levels", '"/admin/campaigns"', "/admin/promotions", "/admin/campaigns/${"]) {
      expect(code.includes(path), `${name} ยังเรียก ${path} เอง`).toBe(false)
    }
  }
})

test("AC-32: export ของ support/flash-sale ทุกตัวมีผู้ใช้จริง ≥ 2 ไฟล์", () => {
  const exported = Array.from(read("support/flash-sale.ts").matchAll(/^export (?:async function|function|const) (\w+)/gm), (m) => m[1])
  expect(exported.length).toBeGreaterThan(0)
  for (const name of exported) {
    const users = USERS.filter((file) => new RegExp(`\\b${name}\\(`).test(read(file)))
    expect(users.length, `${name} ใช้ใน ${users}`).toBeGreaterThanOrEqual(2)
  }
})

test("AC-32: e2e ของ FS-23 เปิด PDP ด้วย ?v_id= ทุกครั้ง (ไม่สมมติว่า variant แรกถูกเลือก)", () => {
  const gotos = read(FS23).match(/page\.goto\([^)]*\/products\/[^)]*\)/g) ?? []
  expect(gotos.length).toBeGreaterThan(0)
  for (const goto of gotos) expect(goto).toContain("?v_id=")
})

test("AC-32: จำนวน expect ของแต่ละ test และแต่ละไฟล์ไม่ลด", () => {
  for (const [name, baseline] of Object.entries(BASELINE)) {
    const code = read(name)
    expect(countExpect(code), `${name} ทั้งไฟล์`).toBeGreaterThanOrEqual(baseline.file)
    const tests = code.split(/\ntest\(/).slice(1).map(countExpect)
    expect(tests.length, `${name} จำนวน test`).toBe(baseline.tests.length)
    tests.forEach((n, i) => expect(n, `${name} test ที่ ${i + 1}`).toBeGreaterThanOrEqual(baseline.tests[i]))
  }
})
