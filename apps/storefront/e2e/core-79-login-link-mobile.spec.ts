import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// CORE-79: spec 01 AC-178 (กฎข้อ 137) — ที่ 375px ปุ่ม register-login-link แตะได้สูง ≥ 44px
// และกดแล้วสลับเป็นฟอร์ม login ที่ email-input มีอีเมลที่กรอกในฟอร์มสมัคร (ช่องรหัสผ่านว่าง); หา element ด้วย data-testid
test.use({ viewport: { width: 375, height: 812 }, evidenceTarget: { feature: "core", taskId: "CORE-79" } })

test("AC-178: 375px register-login-link สูง ≥ 44px และกดแล้วเติมอีเมลในฟอร์ม login", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))

  await step("สมัครด้วยอีเมลที่มีบัญชีแล้ว → เห็น register-login-link สูง ≥ 44px", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await page.getByTestId("register-button").click()
    const form = page.getByTestId("register-page")
    await expect(form).toBeVisible()
    await form.getByTestId("first-name-input").fill("สมชาย")
    await form.getByTestId("last-name-input").fill("ใจดี")
    await form.getByTestId("email-input").fill(customer.email)
    await form.getByTestId("password-input").fill(customer.password)
    await form.getByTestId("register-button").click()
    const link = page.getByTestId("register-login-link")
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    await evidence("01-register-login-link-375")
  })

  await step("กด register-login-link → ฟอร์ม login มีอีเมลเดิม ช่องรหัสผ่านว่าง", async () => {
    await page.getByTestId("register-login-link").click()
    const login = page.getByTestId("login-page")
    await expect(login).toBeVisible()
    await expect(login.getByTestId("email-input")).toHaveValue(customer.email)
    await expect(login.getByTestId("password-input")).toHaveValue("")
    await evidence("02-login-prefilled-email")
  })

  await step("กรอกรหัสผ่าน → เข้าสู่ระบบได้ (มี cookie _medusa_jwt)", async () => {
    await page.getByTestId("password-input").fill(customer.password)
    await page.getByTestId("sign-in-button").click()
    // ที่ 375px overview-page-wrapper ถูกซ่อน (เมนู account แทน) จึงตรวจ cookie ของ session แทน
    await expect(page.getByTestId("login-page")).toHaveCount(0)
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === "_medusa_jwt")).toBeDefined()
  })
})
