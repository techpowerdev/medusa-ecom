import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-19b (spec 01 AC-64 ส่วน grep): helper continueToReview ต้องกดปุ่มครั้งเดียว ไม่มี retry click
const STRIPE_SUPPORT = path.resolve(__dirname, "support", "stripe.ts")

test("AC-64: continueToReview ใน e2e/support/stripe.ts กดครั้งเดียวไม่มี retry", () => {
  const source = fs.readFileSync(STRIPE_SUPPORT, "utf8")
  const start = source.indexOf("export async function continueToReview")
  expect(start, "มี continueToReview").toBeGreaterThanOrEqual(0)
  const next = source.indexOf("\nexport ", start + 1)
  const body = source.slice(start, next === -1 ? undefined : next)

  expect(body).not.toMatch(/toPass|for\s*\(|while\s*\(|retry/i)
  expect(body.match(/\.click\(/g) ?? []).toHaveLength(1)
})
