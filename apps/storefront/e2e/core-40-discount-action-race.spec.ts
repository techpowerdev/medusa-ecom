import type { APIRequestContext, Page } from "@playwright/test"

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

// CORE-40: spec 01 กฎข้อ 98, AC-134 (qa #264 O-1) — ระหว่างลบโค้ด A (action ค้าง) ใส่โค้ด B ไม่ได้
// และหลังลบเสร็จใส่ B แล้ว cart มีแค่ B (A ไม่กลับมาเงียบๆ) — หา element ด้วย data-testid เท่านั้น
// cart สร้างผ่าน Store API (กฎข้อ 101 — ไม่ใช้ pattern กดใส่ตะกร้าจาก PDP)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-40" } })

/** โค้ดส่วนลดใช้ได้ (ไม่ผูก campaign) — คืน code + id ไว้ลบใน finally */
async function createPromotion(request: APIRequestContext, admin: Headers, tag: string) {
  const code = `CORE40${tag}${Date.now()}`
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

/** โค้ดใน cart ตาม backend (token ของเจ้าของ cart — CORE-12) */
async function backendCodes(request: APIRequestContext, cartId: string, headers: Headers) {
  const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=*promotions`, { headers })
  expect(res.status(), "retrieve cart").toBe(200)
  const { cart } = await res.json()
  return (cart.promotions ?? []).map((p: { code?: string }) => p.code) as (string | undefined)[]
}

/**
 * ค้าง server action ตัวถัดไป (POST + header `next-action`) ไว้ที่ browser จนกว่าจะเรียก `release()`
 * — request ยังไม่ถึง server ระหว่างค้าง แล้วส่งต่อตามจริงเมื่อปล่อย
 */
async function holdNextServerAction(page: Page) {
  let held = 0
  let release!: () => void
  const released = new Promise<void>((r) => {
    release = r
  })
  await page.route("**/*", async (route) => {
    const req = route.request()
    if (held === 0 && req.method() === "POST" && req.headers()["next-action"] !== undefined) {
      held++
      await released
      await route.continue()
      return
    }
    await route.fallback()
  })
  return { held: () => held, release }
}

test("AC-134: ลบโค้ด A ค้าง → ปุ่มใส่โค้ด disabled; ปล่อยแล้วใส่ B → cart มีแค่ B", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const a = await createPromotion(request, admin, "A")
  const b = await createPromotion(request, admin, "B")
  try {
    await run()
  } finally {
    for (const promo of [a, b]) {
      const res = await request.delete(`${BACKEND_URL}/admin/promotions/${promo.promotionId}`, { headers: admin })
      expect(res.ok(), `ลบ promotion ของ test: ${res.status()}`).toBe(true)
    }
  }

  async function run() {
    const customer = await createCustomer(request, pk)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const cartId = await cartReadyForPayment(request, pk, customer)
    const applied = await request.post(`${BACKEND_URL}/store/carts/${cartId}/promotions`, {
      headers,
      data: { promo_codes: [a.code] },
    })
    expect(applied.status(), "apply promotion A").toBe(200)
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

    await page.goto(`/${CC}/checkout`)
    await expect(page.getByTestId("discount-row")).toHaveCount(1)
    await page.getByTestId("add-discount-button").click()
    await expect(page.getByTestId("discount-apply-button")).toBeEnabled()

    const hold = await holdNextServerAction(page)
    await step("กดลบ A ขณะ server action ค้าง → discount-apply-button disabled", async () => {
      await page.getByTestId("remove-discount-button").click()
      await expect.poll(hold.held).toBe(1)
      await expect(page.getByTestId("discount-apply-button")).toBeDisabled()
    })

    await step("ปล่อยการลบ แล้วใส่ B ผ่าน UI → backend มีโค้ด [B] เท่านั้น", async () => {
      hold.release()
      await expect(page.getByTestId("discount-row")).toHaveCount(0)
      await expect(page.getByTestId("discount-apply-button")).toBeEnabled()
      await page.getByTestId("discount-input").fill(b.code)
      await page.getByTestId("discount-apply-button").click()
      await expect.poll(() => backendCodes(request, cartId, headers)).toEqual([b.code])
      await expect(page.getByTestId("discount-row")).toHaveCount(1)
    })
  }
})
