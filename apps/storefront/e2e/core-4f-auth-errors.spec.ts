import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-4f: spec 01 AC-98 (กฎข้อ 62) — error หน้า login/register เป็นไทยและคงอีเมลที่กรอกไว้; หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4f" } })

test("AC-98: login รหัสผ่านผิด / สมัครด้วยอีเมลที่มีบัญชีแล้ว → error ไทย และอีเมลยังอยู่", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))

  await step("login ด้วยรหัสผ่านผิด → login-error-message ไทย ไม่ใช่ข้อความของ auth provider, อีเมลยังอยู่", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(`${customer.password}-wrong`)
    await page.getByTestId("sign-in-button").click()
    const error = page.getByTestId("login-error-message")
    await expect(error).toBeVisible()
    const text = (await error.textContent()) ?? ""
    expect(text).toMatch(THAI)
    expect(text).not.toMatch(/Invalid|email|password/i)
    await expect(page.getByTestId("email-input")).toHaveValue(customer.email)
    await evidence("01-login-wrong-password")
  })

  await step("สมัครด้วยอีเมลที่มีบัญชีแล้ว → register-error ไทย, อีเมลยังอยู่", async () => {
    await page.getByTestId("register-button").click()
    const form = page.getByTestId("register-page")
    await expect(form).toBeVisible()
    await form.getByTestId("first-name-input").fill("สมชาย")
    await form.getByTestId("last-name-input").fill("ใจดี")
    await form.getByTestId("email-input").fill(customer.email)
    await form.getByTestId("password-input").fill(`${customer.password}-other`)
    await form.getByTestId("register-button").click()
    const error = page.getByTestId("register-error")
    await expect(error).toBeVisible()
    const text = (await error.textContent()) ?? ""
    expect(text).toMatch(THAI)
    expect(text).not.toMatch(/Invalid|Identity|exists|password/i)
    await expect(form.getByTestId("email-input")).toHaveValue(customer.email)
    await evidence("02-register-email-taken")
  })
})
