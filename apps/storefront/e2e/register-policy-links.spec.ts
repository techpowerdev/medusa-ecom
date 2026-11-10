import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// CORE-4c2: spec 01 กฎข้อ 41 / AC-77 — ลิงก์นโยบายความเป็นส่วนตัว/ข้อกำหนดการใช้งานในฟอร์มสมัครชี้หน้า policy ที่มีจริง
// (ไม่ใช่ `/content/*` ของ starter ซึ่งเป็น 404) หา element ด้วย data-testid เท่านั้น
test("AC-77: ลิงก์นโยบาย/ข้อกำหนดในฟอร์มสมัครชี้หน้าที่มีจริง", async ({ page, request, step }) => {
  await step("ฟอร์มสมัคร", async () => {
    await page.goto(`/${CC}/account`)
    await page.getByTestId("register-button").click()
    await expect(page.getByTestId("register-page")).toBeVisible()
    await expect(page.locator('a[href*="/content/"]')).toHaveCount(0)
  })

  for (const [id, suffix] of [
    ["register-privacy-link", `/${CC}/privacy`],
    ["register-terms-link", `/${CC}/terms`],
  ]) {
    await step(id, async () => {
      const href = (await page.getByTestId(id).getAttribute("href")) ?? ""
      expect(href.endsWith(suffix), `${id} href=${href}`).toBe(true)
      expect((await request.get(href)).status(), href).toBe(200)
    })
  }
})
