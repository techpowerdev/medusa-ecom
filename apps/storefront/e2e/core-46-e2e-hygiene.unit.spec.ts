import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-46 (spec 01 กฎข้อ 104, AC-140 grep): ขยาย AC-137 ไป e2e/support + hygiene ของ action/สินค้า seed
const E2E = __dirname
const read = (...parts: string[]) => fs.readFileSync(path.join(E2E, ...parts), "utf8")

/** ทุกไฟล์ .ts ใต้ e2e/ (รวม support/) — ยกเว้น `*.unit.spec.ts` (grep test อย่างไฟล์นี้มีข้อความของ pattern เอง ไม่ได้คุม browser) */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".unit.spec.ts") ? [path.relative(E2E, full)] : []
  })
const files = walk(E2E)

/** CORE-49 (กฎข้อ 107b): ห้ามเฉพาะ**การตั้งค่า** key timeout (ตัด comment ออกก่อน — คำว่า timeout ใน comment ไม่นับ) */
const setsTimeout = (config: string) =>
  /\b(timeout|actionTimeout|navigationTimeout)["']?\s*:/.test(
    config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  )

/** CORE-49 (กฎข้อ 107c): บรรทัดที่มี `/admin/products?handle=` แล้ว `toHaveLength(1)` ภายใน 3 บรรทัดถัดไป */
const SEED_COUNT_NEXT_TO_FETCH = /\/admin\/products\?handle=[^\n]*\n(?:[^\n]*\n){0,2}[^\n]*toHaveLength\(1\)/

test("AC-140: ทุกไฟล์ใน e2e/**/*.ts ไม่มี add-product-button click() ตามด้วย toBeEnabled() (ยกเว้น comment กฎข้อ 101a)", () => {
  const offenders = files.flatMap((name) => {
    const lines = read(name).split("\n")
    return lines.flatMap((line, i) => {
      const next = lines[i + 1] ?? ""
      const clicked = line.includes('getByTestId("add-product-button").click()')
      const enabled = next.includes('getByTestId("add-product-button")).toBeEnabled()')
      const exempt = /101a/.test(line) || /101a/.test(next)
      return clicked && enabled && !exempt ? [`${name}:${i + 1}`] : []
    })
  })
  expect(offenders).toEqual([])
})

test("AC-140 (กฎข้อ 104a): checkoutToPayment ใส่ตะกร้าด้วย addToCartFromPdp", () => {
  const stripe = read("support", "stripe.ts")
  const body = stripe.slice(stripe.indexOf("export async function checkoutToPayment"))
  expect(body.slice(0, body.indexOf("\n}\n"))).toContain("addToCartFromPdp(")
})

test("AC-140 (กฎข้อ 104b): comment เรื่อง timeout ใน server-action.ts อ้าง docs ของ playwright.dev", () => {
  expect(read("support", "server-action.ts")).toMatch(/\/\/.*https:\/\/playwright\.dev\/docs\//)
})

test("AC-140 (กฎข้อ 104c): core-19a และ core-24 ไม่อ่าน headers()[\"next-action\"] เอง แต่ใช้ isAddToCartBody", () => {
  for (const name of ["core-19a-nav-cart-search.spec.ts", "core-24-pdp-quantity.spec.ts"]) {
    const src = read(name)
    expect(src, name).not.toContain('headers()["next-action"]')
    expect(src, name).toContain("waitForServerAction(page, isAddToCartBody)")
  }
})

test("AC-140 (กฎข้อ 104d): e2e ไม่มี admin/products?limit=1 และสามไฟล์ใช้ handle= พร้อม assert จำนวน 1", () => {
  expect(files.filter((name) => read(name).includes("admin/products?limit=1"))).toEqual([])
  for (const name of [
    "affiliate-admin-programs.spec.ts",
    "group-buy-admin-detail.spec.ts",
    "group-buy-admin-dates.spec.ts",
  ]) {
    // CORE-49 (กฎข้อ 107c): toHaveLength(1) ต้องอยู่ภายใน 3 บรรทัดถัดจากบรรทัดที่ดึง handle= — ไม่ค้นทั้งไฟล์
    expect(read(name), name).toMatch(SEED_COUNT_NEXT_TO_FETCH)
  }
})

test("AC-140/AC-144 (กฎข้อ 107b): playwright.config.ts ไม่ตั้ง timeout/expect.timeout/actionTimeout/navigationTimeout", () => {
  expect(setsTimeout(fs.readFileSync(path.join(E2E, "..", "playwright.config.ts"), "utf8"))).toBe(false)
})

test("AC-144 (กฎข้อ 107b): regex ของ config ตรวจเฉพาะการตั้งค่า — comment ที่มีคำว่า timeout ไม่ทำให้ล้ม", () => {
  expect(setsTimeout("// ไม่ตั้ง timeout: ใช้ default\n/* actionTimeout: 0 */\nexport default {}")).toBe(false)
  for (const config of ["{ timeout: 1 }", "{ use: { actionTimeout: 1 } }", "{ expect: { timeout: 1 } }", "{ use: { navigationTimeout: 1 } }"]) {
    expect(setsTimeout(config), config).toBe(true)
  }
})

test("AC-140: ไฟล์ที่แตะไม่มี waitForTimeout / force", () => {
  for (const name of [
    path.join("support", "stripe.ts"),
    path.join("support", "server-action.ts"),
    "core-19a-nav-cart-search.spec.ts",
    "core-24-pdp-quantity.spec.ts",
    "group-buy-admin-detail.spec.ts",
    "group-buy-admin-dates.spec.ts",
    "affiliate-admin-programs.spec.ts",
  ]) {
    const src = read(name)
    expect(src, name).not.toContain("waitForTimeout")
    expect(src, name).not.toMatch(/force:\s*true/)
  }
})

test("AC-144 (กฎข้อ 107e): core-25, core-26, fs19 รอ action ด้วย waitForServerAction(page, isAddToCartBody) ไม่อ่าน headers()[\"next-action\"] เอง", () => {
  for (const name of ["core-25-pdp-option-reset.spec.ts", "core-26-cart-dropdown-total.spec.ts", "flash-sale-fs19.spec.ts"]) {
    const src = read(name)
    expect(src, name).not.toContain('headers()["next-action"]')
    expect(src, name).toContain("waitForServerAction(page, isAddToCartBody)")
  }
  expect(read("flash-sale-fs19.spec.ts")).toContain("isServerAction(")
})
