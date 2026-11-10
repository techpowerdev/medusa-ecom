import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-23: spec 01 กฎข้อ 49–53, AC-85..89 (defect ของ starter จาก qa #99)
// หา element ด้วย data-testid เท่านั้น ตรวจความเป็นไทยด้วย regex อักษรไทย
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-23" } })

const NOT_SET = "ยังไม่ได้ระบุ"

const storeHeaders = (pk: string, customer: Customer) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

async function setPhone(request: APIRequestContext, pk: string, customer: Customer, phone: string) {
  const res = await request.post(`${BACKEND_URL}/store/customers/me`, {
    headers: storeHeaders(pk, customer),
    data: { phone },
  })
  expect(res.status(), await res.text()).toBe(200)
}

async function phoneOf(request: APIRequestContext, pk: string, customer: Customer) {
  const res = await request.get(`${BACKEND_URL}/store/customers/me`, {
    headers: storeHeaders(pk, customer),
  })
  expect(res.status()).toBe(200)
  return (await res.json()).customer.phone as string | null
}

test("AC-85: ล้างช่องเบอร์แล้วบันทึก → phone ว่าง และแสดง ยังไม่ได้ระบุ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await setPhone(request, pk, customer, "0812345678")
  await signInAs(context, baseURL!, customer)
  const phone = page.getByTestId("account-phone-editor")

  await step("เปิด editor เบอร์ ล้างค่าแล้วบันทึก", async () => {
    await page.goto(`/${CC}/account/profile`)
    await expect(phone.getByTestId("current-info")).toHaveText("0812345678")
    await phone.getByTestId("edit-button").click()
    // panel เปิดหลัง setTimeout ของ starter — ก่อนเปิด panel เป็น inert (CORE-22) พิมพ์ไม่ติด
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await phone.getByTestId("phone-input").fill("")
    await phone.getByTestId("save-button").click()
    await expect(phone.getByTestId("success-message")).toBeVisible()
  })

  await step("API คืน phone ว่าง และบล็อกเบอร์แสดง ยังไม่ได้ระบุ", async () => {
    await expect.poll(() => phoneOf(request, pk, customer)).toBeFalsy()
    await expect(phone.getByTestId("current-info")).toHaveText(NOT_SET)
    await evidence("01-phone-cleared")
  })
})

test("AC-86, AC-89: อีเมลอ่านอย่างเดียว และ ยังไม่ได้ระบุ ชิดแนวเดียวกับค่าชื่อ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("AC-86: ไม่มี editor อีเมล แต่แสดงอีเมลของลูกค้า", async () => {
    await page.goto(`/${CC}/account/profile`)
    await expect(page.getByTestId("profile-page-wrapper")).toBeVisible()
    await expect(page.getByTestId("account-email-editor")).toHaveCount(0)
    const email = page.getByTestId("account-email")
    await expect(email.getByTestId("current-info")).toHaveText(customer.email)
    await expect(email.getByTestId("edit-button")).toHaveCount(0)
  })

  await step("AC-89: x ของ ยังไม่ได้ระบุ เท่ากับ x ของค่าชื่อ (±2px)", async () => {
    const notSet = page.getByTestId("account-phone-editor").getByTestId("current-info")
    await expect(notSet).toHaveText(NOT_SET)
    const nameBox = await page.getByTestId("account-name-editor").getByTestId("current-info").boundingBox()
    const phoneBox = await notSet.boundingBox()
    expect(Math.abs(phoneBox!.x - nameBox!.x), `${phoneBox!.x} vs ${nameBox!.x}`).toBeLessThanOrEqual(2)
    await evidence("02-profile-email-readonly-aligned")
  })
})

test("AC-87: order ที่ไม่มีอยู่ และ order ของ customer อื่น ตอบ HTTP 404", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const other = await createCustomer(request, pk)
  const otherOrder = await placeOrder(request, pk, other)
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  for (const id of ["order_doesnotexist", otherOrder.id]) {
    await step(`GET order detail ${id} → 404`, async () => {
      const res = await page.goto(`/${CC}/account/orders/details/${id}`)
      expect(res?.status(), id).toBe(404)
      await expect(page.getByTestId("order-details-container")).toHaveCount(0)
    })
  }
})

test("AC-88: token หายระหว่างบันทึกเบอร์ → ไม่มี error ดิบของ React และแสดงข้อความไทย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))
  const phone = page.getByTestId("account-phone-editor")

  await step("เปิด editor เบอร์ แล้วลบ cookie _medusa_jwt", async () => {
    await page.goto(`/${CC}/account/profile`)
    await phone.getByTestId("edit-button").click()
    // panel เปิดหลัง setTimeout ของ starter — ก่อนเปิด panel เป็น inert (CORE-22) พิมพ์ไม่ติด
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await phone.getByTestId("phone-input").fill("0899999999")
    await context.clearCookies({ name: "_medusa_jwt" })
  })

  await step("บันทึก → ข้อความไทยใน editor (ไม่มีหน้า login แทรก)", async () => {
    await phone.getByTestId("save-button").click()
    // CORE-23b (AC-97): ผลลัพธ์แน่นอน — server action คืน error 401 เป็นข้อความไทย ไม่ redirect ไปหน้า login
    const error = phone.getByTestId("error-message")
    await expect(error).toBeVisible()
    await expect(page.getByTestId("login-page")).toHaveCount(0)
    const text = (await error.innerText()).trim()
    expect(text).toMatch(THAI)
    expect(text).not.toMatch(/[A-Za-z]{3,}/)
    const body = (await page.locator("body").innerText()) ?? ""
    expect(body).not.toContain("Minified React error")
    expect(body).not.toMatch(/Application error|server-side exception|Unauthorized/i)
    await evidence("03-token-expired-save")
  })
})
