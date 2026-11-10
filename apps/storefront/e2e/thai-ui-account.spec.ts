import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// CORE-4c1: spec 01 CORE-4 (ADR-014) AC-48 ส่วน login/register, account overview, profile, addresses, orders, verify-account
// หา element ด้วย data-testid เท่านั้น ตรวจ "เป็นภาษาไทย" ด้วยอักษรไทย (ไม่ hard-code ประโยค)
// ไม่เลือก element ที่มีข้อมูลจาก backend (ชื่อ/อีเมลลูกค้า, ชื่อประเทศ)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4c" } })

test("AC-48: หน้า login และ register เป็นภาษาไทย", async ({ page, step, evidence }) => {
  await step("login", async () => {
    await page.goto(`/${CC}/account`)
    await expectThai(page, ["login-page", "sign-in-button"])
    expect(await page.title()).toMatch(THAI)
    await evidence("4c1-01-login-th")
  })

  await step("register", async () => {
    await page.getByTestId("register-button").click()
    await expectThai(page, ["register-page"])
  })
})

test("AC-48: หน้า account ของลูกค้าที่ login แล้วเป็นภาษาไทย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  await step("overview", async () => {
    await page.goto(`/${CC}/account`)
    await expectThai(page, ["account-nav", "overview-stats", "no-orders-message", "account-help"])
    expect(await page.title()).toMatch(THAI)
    await evidence("4c1-02-account-overview-th")
  })

  await step("profile", async () => {
    await page.goto(`/${CC}/account/profile`)
    await expectThai(page, ["account-page-header", "edit-button"])
    expect(await page.title()).toMatch(THAI)
    await evidence("4c1-03-profile-th")
  })

  await step("addresses", async () => {
    await page.goto(`/${CC}/account/addresses`)
    await expectThai(page, ["account-page-header", "add-address-button"])
    expect(await page.title()).toMatch(THAI)
  })

  await step("orders (ยังไม่มีคำสั่งซื้อ)", async () => {
    await page.goto(`/${CC}/account/orders`)
    await expectThai(page, ["account-page-header", "no-orders-container"])
    expect(await page.title()).toMatch(THAI)
  })
})

test("AC-48: หน้า verify-account (ลิงก์ไม่มี token) เป็นภาษาไทย", async ({ page, step }) => {
  await step("verify-account", async () => {
    await page.goto(`/${CC}/verify-account`)
    await expectThai(page, ["verify-account-page"])
    expect(await page.title()).toMatch(THAI)
  })
})
