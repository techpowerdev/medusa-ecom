import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// CORE-90 (spec 01 กฎข้อ 146a, AC-187): ที่ 375px ปุ่มสลับฟอร์มท้ายหน้า login/register แตะได้สูง ≥ 44px
// และ testid ไม่ซ้ำกับปุ่ม submit (`register-button` = submit ของฟอร์มสมัครเท่านั้น) — หา element ด้วย data-testid
test.use({
  viewport: { width: 375, height: 812 },
  evidenceTarget: { feature: "core", taskId: "CORE-90" },
})

test("AC-187: 375px ปุ่มสลับ login ↔ register สูง ≥ 44px และไม่มี register-button บนหน้า login", async ({
  page,
  step,
  evidence,
}) => {
  await step(
    "หน้า login: ปุ่ม login-to-register-button สูง ≥ 44px และไม่มี register-button",
    async () => {
      await page.goto(`/${CC}/account`)
      await expect(page.getByTestId("login-page")).toBeVisible()
      await expect(page.getByTestId("register-button")).toHaveCount(0)
      const toRegister = page.getByTestId("login-to-register-button")
      await expect(toRegister).toBeVisible()
      expect((await toRegister.boundingBox())!.height).toBeGreaterThanOrEqual(
        44
      )
      await evidence("01-login-to-register-375")
    }
  )

  await step(
    "กดสลับ → หน้า register: ปุ่ม register-to-login-button สูง ≥ 44px",
    async () => {
      await page.getByTestId("login-to-register-button").click()
      await expect(page.getByTestId("register-page")).toBeVisible()
      const toLogin = page.getByTestId("register-to-login-button")
      await expect(toLogin).toBeVisible()
      expect((await toLogin.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      await evidence("02-register-to-login-375")
    }
  )

  await step("กดสลับกลับ → หน้า login", async () => {
    await page.getByTestId("register-to-login-button").click()
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(page.getByTestId("register-page")).toHaveCount(0)
  })
})
