import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-4g: spec 01 กฎข้อ 63, AC-99 — โค้ดส่วนลดที่ Medusa ไม่ใส่ใน cart (campaign หมดอายุ, ตอบ 200) แสดง `promotion-error` ไทย,
// เลือกที่อยู่ที่บันทึกไว้ที่มี field ว่าง (company = null) แล้ว dropdown แสดงที่อยู่นั้น, CountrySelect สูงเท่า Input (±1px)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4g" } })

const PRODUCT = "t-shirt"
const ADDRESS_1 = "99 ถนนสุขุมวิท"

type ExpiredPromotion = { code: string; promotionId: string; campaignId: string }

/** promotion ที่ active แต่อยู่ใน campaign ที่หมดอายุแล้ว (สร้างผ่าน admin API) */
async function createExpiredPromotion(
  request: APIRequestContext,
  admin: Headers
): Promise<ExpiredPromotion> {
  const stamp = Date.now()
  const day = 24 * 60 * 60 * 1000
  const campaign = await request.post(`${BACKEND_URL}/admin/campaigns`, {
    headers: admin,
    data: {
      name: `CORE-4g expired ${stamp}`,
      campaign_identifier: `core4g-expired-${stamp}`,
      starts_at: new Date(stamp - 10 * day).toISOString(),
      ends_at: new Date(stamp - day).toISOString(),
    },
  })
  expect(campaign.ok(), `create campaign: ${await campaign.text()}`).toBe(true)
  const campaignId = (await campaign.json()).campaign.id

  const code = `CORE4GEXP${stamp}`
  const promotion = await request.post(`${BACKEND_URL}/admin/promotions`, {
    headers: admin,
    data: {
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      campaign_id: campaignId,
      application_method: {
        type: "percentage",
        target_type: "order",
        allocation: "across",
        value: 10,
      },
    },
  })
  if (!promotion.ok()) {
    await request.delete(`${BACKEND_URL}/admin/campaigns/${campaignId}`, { headers: admin })
  }
  expect(promotion.ok(), `create promotion: ${await promotion.text()}`).toBe(true)
  return { code, campaignId, promotionId: (await promotion.json()).promotion.id }
}

test("AC-99: โค้ดหมดอายุแสดง promotion-error ไทย, dropdown ที่อยู่ที่มี field ว่าง, ความสูง CountrySelect", async ({
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
  const promo = await createExpiredPromotion(request, admin)
  try {
    await checkout()
  } finally {
    const promotion = await request.delete(`${BACKEND_URL}/admin/promotions/${promo.promotionId}`, {
      headers: admin,
    })
    expect(promotion.ok(), `ลบ promotion ของ test: ${promotion.status()}`).toBe(true)
    const campaign = await request.delete(`${BACKEND_URL}/admin/campaigns/${promo.campaignId}`, {
      headers: admin,
    })
    expect(campaign.ok(), `ลบ campaign ของ test: ${campaign.status()}`).toBe(true)
  }

  async function checkout() {
    const customer = await createCustomer(request, pk)
    const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    // ไม่ส่ง company → Medusa เก็บเป็น null ส่วนฟอร์ม checkout เก็บเป็น ""
    const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
      headers: store,
      data: {
        first_name: "สมชาย",
        last_name: "ใจดี",
        address_1: ADDRESS_1,
        postal_code: "10110",
        city: "วัฒนา",
        province: "กรุงเทพมหานคร",
        country_code: CC,
        phone: "0812345678",
      },
    })
    expect(saved.status(), "saved address").toBe(200)
    await signInAs(context, baseURL!, customer)

    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await page.goto(`/${CC}/checkout?step=address`)
    await expect(page.getByTestId("shipping-first-name-input")).toBeVisible()

    await step("เลือกที่อยู่ที่บันทึกไว้ (company ว่าง) → dropdown แสดงที่อยู่นั้น ไม่ใช่ placeholder", async () => {
      const select = page.getByTestId("shipping-address-select")
      await select.click()
      await page.getByTestId("shipping-address-option").first().click()
      await expect(page.getByTestId("shipping-first-name-input")).toHaveValue("สมชาย")
      await expect(select).toHaveText(ADDRESS_1)
      await expect(select).not.toHaveText(/เลือกที่อยู่/)
    })

    await step("หลังฟอนต์โหลดครบ CountrySelect สูงเท่า Input ข้างเคียง (±1px)", async () => {
      await page.evaluate(() => document.fonts.ready)
      const heightOf = async (testId: string) => (await page.getByTestId(testId).boundingBox())!.height
      const country = await heightOf("shipping-country-select")
      const city = await heightOf("shipping-city-input")
      const province = await heightOf("shipping-province-input")
      expect(Math.abs(country - city), `country ${country} city ${city}`).toBeLessThanOrEqual(1)
      expect(Math.abs(country - province), `country ${country} province ${province}`).toBeLessThanOrEqual(1)
      await evidence("4g-01-address-select-and-country-height")
    })

    await step("ใส่โค้ดของ campaign ที่หมดอายุ → promotion-error ไทย และ cart ไม่มีโค้ดนั้น", async () => {
      await page.getByTestId("add-discount-button").click()
      await page.getByTestId("discount-input").fill(promo.code)
      await page.getByTestId("discount-apply-button").click()
      const error = page.getByTestId("promotion-error")
      await expect(error).toBeVisible({ timeout: 15_000 })
      await expect(error).toHaveText(THAI)
      await expect(page.getByTestId("discount-apply-button")).toBeEnabled()
      await evidence("4g-02-promotion-error")

      const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
      expect(cartId, "cart id cookie").toBeTruthy()
      const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=*promotions`, {
        headers: store,
      })
      expect(res.ok()).toBe(true)
      const { cart } = await res.json()
      const codes = (cart.promotions ?? []).map((p: { code?: string }) => p.code)
      expect(codes).not.toContain(promo.code)
    })
  }
})
