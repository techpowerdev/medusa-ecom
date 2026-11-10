import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-43 (spec 01 กฎข้อ 101, AC-137 grep): e2e รอเงื่อนไขที่ถูกต้องแทน timeout default
const E2E = __dirname
const read = (...parts: string[]) => fs.readFileSync(path.join(E2E, ...parts), "utf8")
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

// grep ของ add-product-button click() และการตรวจ playwright.config.ts อยู่ที่ core-46-e2e-hygiene.unit.spec.ts ที่เดียว (CORE-49 กฎข้อ 107a)
test("AC-137: spec ของข้อ (b) + helper ไม่มี waitForTimeout", () => {
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
