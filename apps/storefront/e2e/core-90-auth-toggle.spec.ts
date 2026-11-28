import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// CORE-90 (spec 01 กฎข้อ 146a, AC-187): ที่ 375px ปุ่มสลับฟอร์มท้ายหน้า login/register เป็น Button variant="link"
// ของ shadcn สูง 36px (เกณฑ์ ≥ 44px แทนด้วย ADR-034 — spec 09 กฎ 63b, AC-58; SFUI-19b)
// และ testid ไม่ซ้ำกับปุ่ม submit (`register-button` = submit ของฟอร์มสมัครเท่านั้น) — หา element ด้วย data-testid
test.use({
  viewport: { width: 375, height: 812 },
  evidenceTarget: { feature: "core", taskId: "CORE-90" },
})

test("AC-187 + AC-58: 375px ปุ่มสลับ login ↔ register เป็น Button link สูง 36px และไม่มี register-button บนหน้า login", async ({
  page,
  step,
  evidence,
}) => {
  await step(
    "หน้า login: ปุ่ม login-to-register-button เป็น Button link สูง 36px และไม่มี register-button",
    async () => {
      await page.goto(`/${CC}/account`)
      await expect(page.getByTestId("login-page")).toBeVisible()
      await expect(page.getByTestId("register-button")).toHaveCount(0)
      const toRegister = page.getByTestId("login-to-register-button")
      await expect(toRegister).toBeVisible()
      expect((await toRegister.boundingBox())!.height).toBe(36)
      await expect(toRegister).toHaveAttribute("data-slot", "button")
      await expect(toRegister).toHaveAttribute("data-variant", "link")
      await evidence("01-login-to-register-375")
    }
  )

  await step(
    "กดสลับ → หน้า register: ปุ่ม register-to-login-button เป็น Button link สูง 36px",
    async () => {
      await page.getByTestId("login-to-register-button").click()
      await expect(page.getByTestId("register-page")).toBeVisible()
      const toLogin = page.getByTestId("register-to-login-button")
      await expect(toLogin).toBeVisible()
      expect((await toLogin.boundingBox())!.height).toBe(36)
      await expect(toLogin).toHaveAttribute("data-slot", "button")
      await expect(toLogin).toHaveAttribute("data-variant", "link")
      await evidence("02-register-to-login-375")
    }
  )

  await step("กดสลับกลับ → หน้า login", async () => {
    await page.getByTestId("register-to-login-button").click()
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(page.getByTestId("register-page")).toHaveCount(0)
  })
})
