import { expect, test } from "@playwright/test"

import { stripeE2eMode } from "./stripe-env"

// review PR #48 blocker 3: skip ได้เฉพาะเมื่อไม่มี key ทั้งคู่ — CI ที่มี key ไม่ครบ/ผิดรูปแบบต้อง fail ไม่ใช่ skip เงียบ
const SK = "sk_test_abc"
const PK = "pk_test_abc"

test("ไม่มี key ทั้งคู่ → skip ทุก test ของ Stripe (ทั้ง CI และในเครื่อง)", () => {
  for (const ci of [true, false]) {
    expect(stripeE2eMode({ ci })).toEqual({ secret: false, ui: false })
    expect(stripeE2eMode({ ci, secret: "", publishable: "" })).toEqual({ secret: false, ui: false })
  }
})

test("มีครบและเป็น test key → รันทั้งหมด", () => {
  expect(stripeE2eMode({ ci: true, secret: SK, publishable: PK })).toEqual({ secret: true, ui: true })
})

test("CI: มี key ตัวเดียว → throw", () => {
  expect(() => stripeE2eMode({ ci: true, secret: SK })).toThrow(/NEXT_PUBLIC_STRIPE_KEY/)
  expect(() => stripeE2eMode({ ci: true, publishable: PK })).toThrow(/STRIPE_API_KEY/)
})

test("รูปแบบผิด (live key, restricted key) → throw ทั้ง CI และในเครื่อง", () => {
  for (const ci of [true, false]) {
    expect(() => stripeE2eMode({ ci, secret: "rk_test_x", publishable: PK })).toThrow(/sk_test_/)
    expect(() => stripeE2eMode({ ci, secret: "sk_live_x", publishable: PK })).toThrow(/sk_test_/)
    expect(() => stripeE2eMode({ ci, secret: SK, publishable: "pk_live_x" })).toThrow(/pk_test_/)
  }
})

test("ในเครื่อง: มีแค่ sk_test_ → รัน AC-9 (ไม่ต้องใช้ Stripe.js) แต่ skip test ที่ต้องใช้ Stripe.js", () => {
  expect(stripeE2eMode({ ci: false, secret: SK })).toEqual({ secret: true, ui: false })
})
