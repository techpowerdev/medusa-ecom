import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { SIGN_IN_AGAIN_MESSAGE } from "../src/lib/util/error-message"

// CORE-14g: spec 01 AC-120 (กฎข้อ 84; qa #222 D-1) — JWT หายระหว่างอยู่หน้า /th/cart แต่ cookie `_medusa_cart_id` ยังอยู่
// server action ต้องได้ cart id เดิม (middleware ไม่ล้าง cookie ใน request ของ action) แล้วคืน `unauthorized`
// → หน้าแสดง SIGN_IN_AGAIN_MESSAGE โดยแถวสินค้ายังอยู่ ไม่ใช่ render เป็นตะกร้าว่าง — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14g" } })

const PRODUCT = "t-shirt"

/** โค้ดส่วนลดใช้ได้ (ไม่ผูก campaign) — คืน code + id ไว้ลบใน finally */
async function createPromotion(request: APIRequestContext, admin: Headers) {
  const code = `CORE14G${Date.now()}`
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

/** customer ที่ล็อกอินแล้ว มี cart 1 line (qty 1) + โค้ดส่วนลด 1 ตัว */
async function customerWithCart(
  request: APIRequestContext,
  context: BrowserContext,
  baseURL: string,
  pk: string,
  code: string
) {
  const customer = await createCustomer(request, pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers })).json()
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const created = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
  expect(created.status(), "create cart").toBe(200)
  const cartId: string = (await created.json()).cart.id
  const { variantId } = await variantOf(request, pk, PRODUCT)
  const line = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
    headers,
    data: { variant_id: variantId, quantity: 1 },
  })
  expect(line.status(), "add line item").toBe(200)
  const promo = await request.post(`${BACKEND_URL}/store/carts/${cartId}/promotions`, {
    headers,
    data: { promo_codes: [code] },
  })
  expect(promo.status(), "apply promotion").toBe(200)
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  return { headers, cartId }
}

/** cart ใน backend (ใช้ token ของเจ้าของ cart — CORE-12) */
async function backendCart(request: APIRequestContext, cartId: string, headers: Headers) {
  const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=*items,*promotions`, { headers })
  expect(res.status(), "retrieve cart").toBe(200)
  const { cart } = await res.json()
  return {
    quantities: (cart.items ?? []).map((i: { quantity: number }) => i.quantity) as number[],
    codes: (cart.promotions ?? []).map((p: { code?: string }) => p.code) as (string | undefined)[],
  }
}

/**
 * ทำ action หนึ่งครั้งแล้วรอ response ของ server action (POST + `next-action`) — ยืนยันว่า request ยังส่ง cookie cart
 * และ response ไม่ล้าง `_medusa_cart_id` (กฎข้อ 84) แล้วข้อความใน `message` เท่ากับ SIGN_IN_AGAIN_MESSAGE แถวสินค้ายังอยู่
 */
async function expectSignInAgain(page: Page, act: () => Promise<void>, message: Locator) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    act(),
  ])
  expect(await response.request().headerValue("cookie"), "action ส่ง cookie cart").toContain("_medusa_cart_id=")
  expect((await response.headerValue("set-cookie")) ?? "", "action ไม่ล้าง cookie cart").not.toContain("_medusa_cart_id")
  await expect(message).toHaveText(SIGN_IN_AGAIN_MESSAGE, { timeout: 10_000 })
  await expect(page.getByTestId("product-row")).toHaveCount(1)
  expect(
    (await page.context().cookies()).some((c) => c.name === "_medusa_cart_id"),
    "browser ยังมี cookie cart"
  ).toBe(true)
}

test("AC-120: ลบ _medusa_jwt บน /th/cart แล้วเปลี่ยนจำนวน/ลบโค้ด/ใส่โค้ด/ลบสินค้า → SIGN_IN_AGAIN_MESSAGE แถวสินค้ายังอยู่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
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
    const { headers, cartId } = await customerWithCart(request, context, baseURL!, pk, promo.code)
    await page.goto(`/${CC}/cart`)
    const row = page.getByTestId("product-row")
    await expect(row).toHaveCount(1)
    await expect(page.getByTestId("discount-row")).toHaveCount(1)
    // promotion-error แสดงเฉพาะเมื่อเปิดช่องใส่โค้ด (component ของ starter) — เปิดก่อนลบ JWT
    await page.getByTestId("add-discount-button").click()
    await expect(page.getByTestId("discount-input")).toBeVisible()

    // ลบ JWT โดยไม่ reload (คง `_medusa_cart_id`)
    await context.clearCookies({ name: "_medusa_jwt" })

    await step("(1) เปลี่ยนจำนวน → product-error-message", async () => {
      await expectSignInAgain(
        page,
        async () => {
          await row.getByTestId("product-select-button").selectOption("2")
        },
        row.getByTestId("product-error-message")
      )
      await evidence("01-quantity-sign-in-again")
    })

    await step("(2) ลบโค้ดส่วนลด → promotion-error", async () => {
      await expectSignInAgain(
        page,
        () => page.getByTestId("remove-discount-button").click(),
        page.getByTestId("promotion-error")
      )
      await expect(page.getByTestId("discount-row")).toHaveCount(1)
    })

    await step("(3) ใส่โค้ด → promotion-error", async () => {
      await page.getByTestId("discount-input").fill(promo.code)
      await expectSignInAgain(
        page,
        () => page.getByTestId("discount-apply-button").click(),
        page.getByTestId("promotion-error")
      )
      await evidence("02-promotion-sign-in-again")
    })

    await step("(4) ลบสินค้า → cart-item-remove-error", async () => {
      await expectSignInAgain(
        page,
        () => row.getByTestId("product-delete-button").click(),
        row.getByTestId("cart-item-remove-error")
      )
      await evidence("03-remove-sign-in-again")
    })

    await step("cart ใน backend ไม่เปลี่ยน", async () => {
      expect(await backendCart(request, cartId, headers)).toEqual({ quantities: [1], codes: [promo.code] })
    })
  }
})
