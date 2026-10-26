import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// CORE-4c2: spec 01 CORE-4 (ADR-014) AC-48 ส่วน cart, order confirmed, order detail, หน้า policy ทั้ง 5
// + follow-up รอบ 7: AC-78 (วันที่เขตเวลาไทย ไม่มี hydration mismatch ที่หน้า orders)
// หา element ด้วย data-testid เท่านั้น ตรวจ "เป็นภาษาไทย" ด้วยอักษรไทย (ไม่ hard-code ประโยค)
// ไม่เลือก element ที่มีข้อมูลจาก backend (ชื่อสินค้า/ตัวเลือก, อีเมล, ที่อยู่, ชื่อวิธีชำระเงิน/จัดส่ง)
test.use({
  evidenceTarget: { feature: "core", taskId: "CORE-4c2" },
  // AC-78: browser คนละเขตเวลากับ server — วันที่ที่ไม่ระบุ timeZone จะ render ต่างกัน (hydration mismatch / วันเพี้ยน)
  timezoneId: "America/New_York",
})

const PRODUCT = "t-shirt" // seed (CORE-2)
const POLICY_PAGES = ["contact", "terms", "privacy", "returns", "shipping"]

type Store = { request: APIRequestContext; headers: Record<string, string> }

const post = async ({ request, headers }: Store, url: string, data: object) => {
  const res = await request.post(`${BACKEND_URL}${url}`, { headers, data })
  expect(res.status(), `POST ${url}`).toBe(200)
  return res.json()
}

/** cart ของ customer ที่มีสินค้า 1 ชิ้น (ผ่าน store API ด้วย token ของเจ้าของ cart — CORE-6/CORE-12) */
async function cartWithItem(store: Store, pk: string): Promise<string> {
  const regions = await (
    await store.request.get(`${BACKEND_URL}/store/regions?fields=id,*countries`, { headers: store.headers })
  ).json()
  const region = regions.regions.find((r: { countries: { iso_2: string }[] }) =>
    r.countries.some((c) => c.iso_2 === CC)
  )
  const { cart } = await post(store, "/store/carts", { region_id: region.id })
  const { variantId } = await variantOf(store.request, pk, PRODUCT)
  await post(store, `/store/carts/${cart.id}/line-items`, { variant_id: variantId, quantity: 1 })
  return cart.id
}

/** สั่งซื้อด้วย manual payment ผ่าน store API (flow เดียวกับ checkout ของ storefront) */
async function placeOrder(store: Store, pk: string, customer: Customer): Promise<string> {
  const cartId = await cartWithItem(store, pk)
  await post(store, `/store/carts/${cartId}`, {
    email: customer.email,
    shipping_address: {
      first_name: "Somchai",
      last_name: "Jaidee",
      address_1: "1 Sukhumvit Rd",
      city: "Bangkok",
      postal_code: "10110",
      country_code: CC,
    },
  })
  const options = await (
    await store.request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: store.headers,
    })
  ).json()
  const standard = options.shipping_options.find((o: { name: string }) => o.name === "Standard")
  await post(store, `/store/carts/${cartId}/shipping-methods`, { option_id: standard.id })
  const { payment_collection } = await post(store, "/store/payment-collections", { cart_id: cartId })
  await post(store, `/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    provider_id: "pp_system_default",
  })
  const completed = await post(store, `/store/carts/${cartId}/complete`, {})
  expect(completed.type, "cart complete").toBe("order")
  return completed.order.id
}

test("AC-48: หน้า policy ทั้ง 5 เป็นภาษาไทย", async ({ page, step, evidence }) => {
  for (const name of POLICY_PAGES) {
    await step(`/${name}`, async () => {
      await page.goto(`/${CC}/${name}`)
      await expectThai(page, ["policy-title", "policy-content"])
      expect(await page.title()).toMatch(THAI)
      if (name === "shipping") await evidence("4c2-01-policy-shipping-th")
    })
  }
})

test("AC-48, AC-78: cart, order confirmed, order detail และรายการ orders เป็นภาษาไทย ไม่มี hydration mismatch", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const store: Store = {
    request,
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  }
  await signInAs(context, baseURL!, customer)

  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })

  const orderId = await placeOrder(store, pk, customer)

  await step("cart ที่มีสินค้า", async () => {
    const cartId = await cartWithItem(store, pk)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/cart`)
    await expectThai(page, ["cart-title", "cart-items-header", "cart-summary-title", "cart-totals", "checkout-button"])
    expect(await page.title()).toMatch(THAI)
    await evidence("4c2-02-cart-th")
  })

  await step("order confirmed", async () => {
    await page.goto(`/${CC}/order/${orderId}/confirmed`)
    await expectThai(page, [
      "order-complete-heading",
      "order-complete-summary-heading",
      "cart-totals",
      "shipping-details-heading",
      "payment-details-heading",
      "order-help",
    ])
    expect(await page.title()).toMatch(THAI)
    await evidence("4c2-03-order-confirmed-th")
  })

  await step("order detail", async () => {
    await page.goto(`/${CC}/account/orders/details/${orderId}`)
    await expectThai(page, [
      "order-details-heading",
      "back-to-overview-button",
      "order-status",
      "order-payment-status",
      "order-summary",
      "order-help",
    ])
    await expect(page.getByTestId("order-date")).toHaveText(THAI)
    await evidence("4c2-04-order-detail-th")
  })

  await step("รายการ orders: วันที่ไทย ไม่มี hydration mismatch (AC-78)", async () => {
    consoleErrors.length = 0
    await page.goto(`/${CC}/account/orders`)
    await expect(page.getByTestId("order-card").first()).toBeVisible()
    await expect(page.getByTestId("order-created-at").first()).toHaveText(THAI)
    // หน้า account มี request ค้าง (networkidle ไม่จบ) — รอ load แล้วเว้นช่วงให้ React hydrate และ log error (ถ้ามี)
    await page.waitForLoadState("load")
    await page.waitForTimeout(2_000)
    expect(consoleErrors.filter((t) => /hydrat|#418|#423|#425/i.test(t))).toEqual([])
    await evidence("4c2-05-orders-th")
  })
})
