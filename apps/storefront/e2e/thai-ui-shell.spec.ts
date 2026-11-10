import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// CORE-4b1: spec 01 CORE-4 (ADR-014) AC-46, AC-48 (layout shell + home + not-found), AC-50 (= AC-10)
// หา element ด้วย data-testid เท่านั้น ตรวจ "เป็นภาษาไทย" ด้วยอักษรไทย ไม่ hard-code ประโยค
// evidence ใช้โฟลเดอร์ CORE-4b (รูปแบบ task id ของ evidence ไม่รับ "4b1") — 4b1 ใช้ 3 รูป เหลือให้ 4b2
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4b" } })

test("AC-46, AC-48, AC-50: หน้าแรกและ layout shell เป็นภาษาไทย ไม่มีตัวเลือกภาษา ใช้ Noto Sans Thai", async ({
  page,
  context,
  step,
  evidence,
}) => {
  const googleFontRequests: string[] = []
  page.on("request", (req) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(req.url())) {
      googleFontRequests.push(req.url())
    }
  })

  await step("เปิดหน้าแรกโดยไม่มี cookie locale", async () => {
    await page.goto(`/${CC}`)
    await page.waitForLoadState("networkidle")
    await expect(page.locator("html")).toHaveAttribute("lang", "th")
    expect(await page.title()).toMatch(THAI)
  })

  await step("AC-48: nav, hero และ footer เป็นภาษาไทย", async () => {
    await expectThai(page, [
      "nav-menu-button",
      "nav-account-link",
      "nav-cart-link",
      "hero-title",
      "footer-customer-service",
    ])
    await evidence("4b1-01-home-th")
  })

  await step("AC-50: body ใช้ Noto Sans Thai และไม่มี request ไป Google Fonts", async () => {
    const fontFamily = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily
    )
    expect(fontFamily).toContain("Noto Sans Thai")
    expect(googleFontRequests).toEqual([])
  })

  await step("AC-46: side menu เป็นภาษาไทย ไม่มี language-select และไม่มี cookie _medusa_locale", async () => {
    await page.getByTestId("nav-menu-button").click()
    await expect(page.getByTestId("nav-menu-popup")).toBeVisible()
    await expectThai(page, ["home-link", "store-link", "account-link", "cart-link"])
    await expect(page.getByTestId("language-select")).toHaveCount(0)
    const cookies = await context.cookies()
    expect(cookies.map((c) => c.name)).not.toContain("_medusa_locale")
    expect(await page.evaluate(() => document.cookie)).not.toContain("_medusa_locale")
    await evidence("4b1-02-side-menu-th")
  })
})

test("AC-48: หน้า not-found ของ (main) เป็นภาษาไทย", async ({ page, step, evidence }) => {
  await step("เปิด path ที่ไม่มีอยู่", async () => {
    await page.goto(`/${CC}/categories/__no-such-category-core-4b__`)
    await expectThai(page, ["not-found-title", "not-found-description", "not-found-home-link"])
    await evidence("4b1-03-not-found-th")
  })
})
