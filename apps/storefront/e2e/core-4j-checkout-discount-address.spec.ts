import type { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-4j: spec 01 กฎข้อ 73, AC-111 (qa/review #170) — โค้ดส่วนลดที่มีช่องว่างหัวท้ายใช้ได้ (trim, ไม่แปลงตัวพิมพ์),
// ใส่โค้ดขณะฟอร์มที่อยู่ยังไม่บันทึกแล้วค่าที่พิมพ์ไม่หาย และ `billing-country-code-select` สูงเท่า input ข้างเคียง (±1px)
// หา element ด้วย data-testid เท่านั้น; cart สร้างผ่าน Store API (กฎข้อ 101)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4j" } })

/** โค้ดส่วนลดใช้ได้ (ไม่ผูก campaign) มีตัวเล็กปน — ตรวจว่าไม่ถูกแปลงตัวพิมพ์ */
async function createPromotion(request: APIRequestContext, admin: Headers) {
  const code = `Core4j-${Date.now()}`
  const res = await request.post(`${BACKEND_URL}/admin/promotions`, {
    headers: admin,
    data: {
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10 },
    },
  })
  expect(res.ok(), `create promotion: ${await res.text()}`).toBe(true)
  return { code, promotionId: (await res.json()).promotion.id as string }
}

async function backendCodes(request: APIRequestContext, cartId: string, headers: Headers) {
  const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=*promotions`, { headers })
  expect(res.status(), "retrieve cart").toBe(200)
  const { cart } = await res.json()
  return (cart.promotions ?? []).map((p: { code?: string }) => p.code) as (string | undefined)[]
}

// ค่าที่พิมพ์ทับที่อยู่เดิมของ cart (ยังไม่กดบันทึก)
const TYPED = {
  "shipping-first-name-input": "สมหญิง",
  "shipping-address-input": "42 ถนนพระราม 4",
  "shipping-city-input": "ปทุมวัน",
  "shipping-email-input": "typed-core4j@example.com",
  "billing-first-name-input": "บริษัท ทดสอบ",
  "billing-address-input": "7 ถนนสีลม",
}

test("AC-111: โค้ดมีช่องว่างหัวท้ายใช้ได้ และค่าที่พิมพ์ในฟอร์มที่อยู่ไม่หายหลังใส่โค้ด", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const promo = await createPromotion(request, admin)
  try {
    await run()
  } finally {
    const res = await request.delete(`${BACKEND_URL}/admin/promotions/${promo.promotionId}`, { headers: admin })
    expect(res.ok(), `ลบ promotion ของ test: ${res.status()}`).toBe(true)
  }

  async function run() {
    const customer = await createCustomer(request, pk)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const cartId = await cartReadyForPayment(request, pk, customer)
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

    await page.goto(`/${CC}/checkout?step=address`)
    await expect(page.getByTestId("shipping-first-name-input")).toHaveValue("Somchai")

    await step("พิมพ์ทับที่อยู่จัดส่งและที่อยู่ใบเสร็จ (ไม่กดบันทึก)", async () => {
      await page.getByTestId("billing-address-checkbox").click()
      await expect(page.getByTestId("billing-first-name-input")).toBeVisible()
      for (const [testId, value] of Object.entries(TYPED)) {
        await page.getByTestId(testId).fill(value)
      }
    })

    await step("ใส่โค้ดที่มีช่องว่างหัวท้าย → cart มีโค้ดนั้น ไม่มี promotion-error", async () => {
      await page.getByTestId("add-discount-button").click()
      await page.getByTestId("discount-input").fill(`  ${promo.code}  `)
      await page.getByTestId("discount-apply-button").click()
      await expect.poll(() => backendCodes(request, cartId, headers), { timeout: 30_000 }).toEqual([promo.code])
      await expect(page.getByTestId("discount-row")).toHaveCount(1)
      await expect(page.getByTestId("discount-code")).toContainText(promo.code)
      await expect(page.getByTestId("promotion-error")).toHaveCount(0)
    })

    await step("ค่าที่พิมพ์ในฟอร์มที่อยู่ยังอยู่หลัง cart refresh", async () => {
      for (const [testId, value] of Object.entries(TYPED)) {
        await expect(page.getByTestId(testId), testId).toHaveValue(value)
      }
      await evidence("4j-01-address-kept-after-discount")
    })
  }
})

test("AC-111: หลัง document.fonts.ready billing-country-code-select สูงเท่า input ข้างเคียง (±1px)", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))
  await page.goto(`/${CC}/account/profile`)
  const billing = page.getByTestId("account-billing-address-editor")
  await billing.getByTestId("edit-button").click()
  await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
  const select = billing.getByTestId("billing-country-code-select")
  await expect(select).toBeVisible()

  await page.evaluate(() => document.fonts.ready)
  const heightOf = async (testId: string) => (await billing.getByTestId(testId).boundingBox())!.height
  const country = await heightOf("billing-country-code-select")
  const province = await heightOf("billing-province-input")
  expect(Math.abs(country - province), `country ${country} province ${province}`).toBeLessThanOrEqual(1)
  await select.scrollIntoViewIfNeeded()
  await evidence("4j-02-billing-country-select-height")
})
