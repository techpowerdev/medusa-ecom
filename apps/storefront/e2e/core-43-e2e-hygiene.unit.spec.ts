import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-43 (spec 01 กฎข้อ 101, AC-137 grep): e2e รอเงื่อนไขที่ถูกต้องแทน timeout default
const E2E = __dirname
const read = (...parts: string[]) => fs.readFileSync(path.join(E2E, ...parts), "utf8")
const specs = fs
  .readdirSync(E2E)
  .filter((name) => name.endsWith(".spec.ts") && !name.endsWith(".unit.spec.ts"))

test("AC-137: ไม่มี add-product-button click() ตามด้วย toBeEnabled() ของปุ่มเดียวกัน (ยกเว้น comment กฎข้อ 101a)", () => {
  const offenders = specs.flatMap((name) => {
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

test("AC-137: helper ของข้อ (a) อยู่ใน e2e/support และ spec ที่เคยใช้ pattern เดิมเรียก helper", () => {
  expect(read("support", "server-action.ts")).toContain("export async function addToCartFromPdp")
  for (const name of [
    "affiliate-last-click.spec.ts",
    "affiliate-tracking.spec.ts",
    "core-38-mobile-layout.spec.ts",
    "core-4e-checkout-polish.spec.ts",
    "core-4g-checkout-polish.spec.ts",
    "core-store.spec.ts",
    "ev-7c-digital-only-checkout.spec.ts",
    "thai-ui-checkout.spec.ts",
  ]) {
    expect(read(name), name).toContain("addToCartFromPdp(")
  }
})

test("AC-137: playwright.config.ts ไม่ตั้ง timeout/expect.timeout และ spec ของข้อ (b) + helper ไม่มี waitForTimeout", () => {
  expect(fs.readFileSync(path.join(E2E, "..", "playwright.config.ts"), "utf8")).not.toMatch(/timeout/i)
  for (const name of [
    "core-14-buy-login.spec.ts",
    "ev-7c-digital-only-checkout.spec.ts",
    "thai-ui-checkout.spec.ts",
    "core-4g-checkout-polish.spec.ts",
    path.join("support", "server-action.ts"),
  ]) {
    expect(read(name), name).not.toContain("waitForTimeout")
  }
})

test("AC-137 (กฎข้อ 101c): billing-city-input มีใน billing_address และ core-38 กรอก LONG_CITY ทั้งเคส digital-only และเคส billing ต่างกัน", () => {
  const billing = fs.readFileSync(
    path.join(E2E, "..", "src", "modules", "checkout", "components", "billing_address", "index.tsx"),
    "utf8"
  )
  expect(billing).toContain('data-testid="billing-city-input"')
  const core38 = read("core-38-mobile-layout.spec.ts")
  expect(core38.match(/getByTestId\("billing-city-input"\)\.fill\(LONG_CITY\)/g)?.length ?? 0).toBe(2)
})
