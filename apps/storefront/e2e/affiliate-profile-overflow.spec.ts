import { Page } from "@playwright/test"
import crypto from "node:crypto"

import { createActiveAffiliate } from "./support/affiliate"
import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders } from "./support/medusa"

// AF-18 (spec 05 กฎ 42, AC-50): หน้า Profile ของ portal ไม่ล้นแนวนอนที่ 375px เมื่ออีเมลยาวไม่มีช่องว่าง
// และที่ 1280 ป้ายกับค่ายังอยู่แถวเดียวกัน — หา element ด้วย data-testid (ADR-014), <dt> หาด้วย DOM relation
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-18" } })

/**
 * อีเมลยาวคงที่ (local part 52 ตัว ไม่มีช่องว่าง/ขีด/จุดที่ตัดบรรทัดได้) — ยาวเท่ากันทุกรอบ จึงล้มทุกครั้งก่อนแก้
 * (อีเมลสุ่มของ helper ยาวไม่เท่ากัน เป็นเหตุที่ qa พบล้นแค่บางรอบ); 12 hex ท้ายกันชนกับรอบก่อน
 */
const longEmail = () => `e2eaf18${"x".repeat(33)}${crypto.randomBytes(6).toString("hex")}@example.com`

async function openProfile(page: Page, who: { email: string; password: string }) {
  await page.goto(`/${CC}/affiliate/login`)
  await page.getByTestId("affiliate-login-email").fill(who.email)
  await page.getByTestId("affiliate-login-password").fill(who.password)
  await page.getByTestId("affiliate-login-submit").click()
  await expect(page).toHaveURL(new RegExp(`/${CC}/affiliate(\\?|$)`))
  await page.goto(`/${CC}/affiliate/profile`)
  await expect(page.getByTestId("affiliate-profile-page")).toBeVisible()
}

test.describe("AC-50 ที่ 375×812", () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test("AC-50: อีเมลยาวไม่มีช่องว่าง → ไม่มี scroll แนวนอน และอีเมลอยู่ในจอครบ", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const email = longEmail()
    expect(email.split("@")[0].length).toBeGreaterThanOrEqual(40)
    const ann = await createActiveAffiliate(request, await adminHeaders(request), "e2e-af18", email)

    await step("เปิด /th/affiliate/profile → scrollWidth ≤ 375 และขอบขวาของอีเมล ≤ 375", async () => {
      await openProfile(page, ann)
      const value = page.getByTestId("affiliate-profile-email")
      await expect(value).toHaveText(email)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
      expect(await value.evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(375)
      await evidence("01-profile-375")
    })
  })
})

test("AC-50: ที่ 1280 ป้ายอีเมล (<dt>) กับค่า (affiliate-profile-email) ยังอยู่แถวเดียวกัน", async ({
  page,
  request,
  step,
}) => {
  const email = longEmail()
  const ann = await createActiveAffiliate(request, await adminHeaders(request), "e2e-af18-wide", email)

  await step("top ของ <dt> ก่อนหน้า กับ affiliate-profile-email ต่างกัน ≤ 2px", async () => {
    await openProfile(page, ann)
    const value = page.getByTestId("affiliate-profile-email")
    await expect(value).toHaveText(email)
    const label = value.locator("xpath=preceding-sibling::dt[1]")
    const [labelTop, valueTop] = await Promise.all([
      label.evaluate((el) => el.getBoundingClientRect().top),
      value.evaluate((el) => el.getBoundingClientRect().top),
    ])
    expect(Math.abs(labelTop - valueTop)).toBeLessThanOrEqual(2)
  })
})
