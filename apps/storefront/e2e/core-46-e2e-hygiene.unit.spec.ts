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
    const src = read(name)
    expect(src, name).toContain("/admin/products?handle=")
    expect(src, name).toMatch(/toHaveLength\(1\)/)
  }
})

// affiliate-admin-programs มี waitForTimeout ของ animation อยู่ก่อน CORE-46 (AC-140 ตรวจที่ diff — ดู evidence) จึงไม่อยู่ในรายการ
test("AC-140: playwright.config.ts ไม่ตั้ง timeout และไฟล์ที่แตะไม่มี waitForTimeout / force", () => {
  expect(fs.readFileSync(path.join(E2E, "..", "playwright.config.ts"), "utf8")).not.toMatch(/timeout/i)
  for (const name of [
    path.join("support", "stripe.ts"),
    path.join("support", "server-action.ts"),
    "core-19a-nav-cart-search.spec.ts",
    "core-24-pdp-quantity.spec.ts",
    "group-buy-admin-detail.spec.ts",
    "group-buy-admin-dates.spec.ts",
  ]) {
    const src = read(name)
    expect(src, name).not.toContain("waitForTimeout")
    expect(src, name).not.toMatch(/force:\s*true/)
  }
})
