import type { Page } from "@playwright/test"
import { expect, test } from "./support/fixtures"
import { createActiveAffiliate } from "./support/affiliate"
import { STOREFRONT_COUNTRY as CC, adminHeaders, createCustomer, publishableKey } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-73: spec 01 AC-172 (กฎข้อ 131) — สมัครด้วยอีเมลที่มีบัญชีลูกค้าแล้ว (รหัสถูกหรือผิด) → ไม่ login ให้,
// เห็น register-email-exists + register-login-link และไม่มี cookie `_medusa_jwt`; หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-73" } })

const submitRegister = async (page: Page, email: string, password: string) => {
  await page.goto(`/${CC}/account`)
  await expect(page.getByTestId("login-page")).toBeVisible()
  await page.getByTestId("register-button").click()
  const form = page.getByTestId("register-page")
  await expect(form).toBeVisible()
  await form.getByTestId("first-name-input").fill("สมชาย")
  await form.getByTestId("last-name-input").fill("ใจดี")
  await form.getByTestId("email-input").fill(email)
  await form.getByTestId("password-input").fill(password)
  await form.getByTestId("register-button").click()
  return form
}

test("AC-172: สมัครด้วยอีเมลที่มีบัญชีแล้ว → ไม่ login ให้ แสดงอีเมลนี้มีบัญชีแล้ว + ลิงก์เข้าสู่ระบบ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  const customer = await createCustomer(request, await publishableKey(request, await adminHeaders(request)))

  const expectNotLoggedIn = async () => {
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === "_medusa_jwt")).toBeUndefined()
  }

  await step("รหัสถูก → อยู่หน้าสมัคร เห็น register-email-exists + register-login-link ไม่มี cookie _medusa_jwt", async () => {
    const form = await submitRegister(page, customer.email, customer.password)
    const exists = page.getByTestId("register-email-exists")
    await expect(exists).toBeVisible()
    expect((await exists.textContent()) ?? "").toMatch(THAI)
    await expect(page.getByTestId("register-login-link")).toBeVisible()
    await expect(form).toBeVisible()
    await expect(form.getByTestId("email-input")).toHaveValue(customer.email)
    await expect(form.getByTestId("first-name-input")).toHaveValue("สมชาย")
    await expect(page).toHaveURL(new RegExp(`/${CC}/account$`))
    await expectNotLoggedIn()
    await evidence("01-register-email-exists")
  })

  const correctText = (await page.getByTestId("register-email-exists").textContent()) ?? ""

  await step("ลิงก์เข้าสู่ระบบ → ไปฟอร์ม login", async () => {
    await page.getByTestId("register-login-link").click()
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expectNotLoggedIn()
  })

  await step("รหัสผิด → ข้อความเดียวกัน", async () => {
    await submitRegister(page, customer.email, `${customer.password}-wrong`)
    const exists = page.getByTestId("register-email-exists")
    await expect(exists).toBeVisible()
    expect((await exists.textContent()) ?? "").toBe(correctText)
    await expect(page.getByTestId("register-login-link")).toBeVisible()
    await expectNotLoggedIn()
    await evidence("02-register-email-exists-wrong-password")
  })
})

test("AC-172 (regression): อีเมลของบัญชี affiliate ที่ยังไม่มี customer → สมัครเป็นลูกค้าได้ตามเดิม", async ({
  page,
  request,
  step,
}) => {
  const affiliate = await createActiveAffiliate(request, await adminHeaders(request), { prefix: "e2e-core73" })

  await step("สมัครด้วยอีเมล/รหัสของ affiliate → เข้าสู่ระบบเป็นลูกค้า มี cookie _medusa_jwt", async () => {
    await submitRegister(page, affiliate.email, affiliate.password)
    await expect(page.getByTestId("overview-page-wrapper")).toBeVisible()
    await expect(page.getByTestId("register-email-exists")).toHaveCount(0)
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === "_medusa_jwt")).toBeDefined()
  })
})
