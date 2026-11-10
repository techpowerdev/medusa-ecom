import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-4h: spec 01 AC-105 (กฎข้อ 69) — กันกด login ซ้ำ, ฟอร์มสมัครที่ล้มคงค่า, error หน้า verify-account เป็นไทย
// หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4h" } })

test("AC-105: dblclick login = action 1 ครั้ง, สมัครล้มคงค่า, verify-account error ไทย", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))

  // นับ server action ของหน้า (POST ที่มี header next-action)
  let actionPosts = 0
  page.on("request", (req) => {
    if (req.method() === "POST" && req.headers()["next-action"]) actionPosts++
  })

  await step("dblclick ปุ่ม login ด้วยรหัสผ่านผิด → action 1 ครั้ง และ login-error-message ไทย", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(`${customer.password}-wrong`)
    actionPosts = 0
    await page.getByTestId("sign-in-button").dblclick()
    const error = page.getByTestId("login-error-message")
    await expect(error).toBeVisible()
    await expect(page.getByTestId("sign-in-button")).toBeEnabled()
    // เผื่อ action รอบที่สองที่ยิงช้ากว่า error รอบแรก
    await page.waitForTimeout(1500)
    expect(actionPosts).toBe(1)
    expect((await error.textContent()) ?? "").toMatch(THAI)
    await evidence("01-login-dblclick-wrong-password")
  })

  await step("สมัครด้วยอีเมลที่มีบัญชีแล้ว → ชื่อ/นามสกุล/เบอร์/อีเมลยังอยู่ และ error ไทย", async () => {
    await page.getByTestId("register-button").click()
    const form = page.getByTestId("register-page")
    await expect(form).toBeVisible()
    await form.getByTestId("first-name-input").fill("สมชาย")
    await form.getByTestId("last-name-input").fill("ใจดี")
    await form.getByTestId("email-input").fill(customer.email)
    await form.getByTestId("phone-input").fill("0812345678")
    await form.getByTestId("password-input").fill(`${customer.password}-other`)
    await form.getByTestId("register-button").click()
    const error = page.getByTestId("register-error")
    await expect(error).toBeVisible()
    expect((await error.textContent()) ?? "").toMatch(THAI)
    await expect(form.getByTestId("first-name-input")).toHaveValue("สมชาย")
    await expect(form.getByTestId("last-name-input")).toHaveValue("ใจดี")
    await expect(form.getByTestId("phone-input")).toHaveValue("0812345678")
    await expect(form.getByTestId("email-input")).toHaveValue(customer.email)
    await evidence("02-register-keeps-fields")
  })

  await step("token ยืนยันอีเมลไม่ถูกต้อง → error ไทย ไม่มีคำอังกฤษ", async () => {
    await page.goto(`/${CC}/verify-account?token=not-a-valid-token`)
    const error = page.getByTestId("verify-account-error")
    await expect(error).toBeVisible()
    const text = (await error.textContent()) ?? ""
    expect(text).toMatch(THAI)
    expect(text).not.toMatch(/[A-Za-z]{4,}/)
    await evidence("03-verify-account-invalid-token")
  })
})
