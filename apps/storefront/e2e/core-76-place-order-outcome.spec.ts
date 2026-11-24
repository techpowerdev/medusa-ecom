import type { APIRequestContext, BrowserContext, Page } from "@playwright/test"

import { INSUFFICIENT_INVENTORY_MESSAGE } from "../src/lib/util/insufficient-inventory"
import { PROCESSING_NOTICE } from "../src/lib/util/place-order-outcome"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { isServerAction } from "./support/server-action"
import { expectThai } from "./support/thai-text"

// CORE-76: spec 01 AC-175 / กฎข้อ 134 — ผลของ complete cart ในขั้น review เป็น kind (ไม่ใช่ข้อความ) — ใช้ manual payment (ไม่ต้องมี Stripe)
// (a) สต็อกไม่พอจริง (ลูกค้าอื่นซื้อชิ้นสุดท้ายผ่าน API) → INSUFFICIENT_INVENTORY_MESSAGE ไม่มี "คืนเงิน"
// (a2) route mock ผลของ server action placeOrder: complete ยิงจาก Next server จึง mock จาก browser ไม่ได้ (แบบ CORE-71) — ส่งต่อด้วย
//      cart id ที่ไม่มีจริง (backend 404 → `{ kind: "failed" }` ตามจริง) แล้วแทน kind ใน payload; 409 → processing แล้วอ่านซ้ำ, 401 → login
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-76" } })

const MANUAL = "pp_system_default"
const FAILED = '"kind":"failed"'

let admin: Headers
let pk: string

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
})

/** แทนผลของ placeOrder(cartId, …) `times` ครั้งแรกด้วย `replacement`; คืนตัวนับจำนวน action ของ placeOrder ที่เห็น */
async function mockPlaceOrder(page: Page, cartId: string, replacement: string, times: number) {
  const seen = { calls: 0 }
  await page.route(
    (url) => url.pathname.endsWith("/checkout"),
    async (route) => {
      const req = route.request()
      const body = req.postData() ?? ""
      if (!isServerAction(req, (b) => b.startsWith(`["${cartId}"`))) return route.fallback()
      seen.calls++
      if (seen.calls > times) return route.fallback()
      const response = await route.fetch({ postData: body.replaceAll(cartId, "cart_core76_missing") })
      const text = await response.text()
      expect(text).toContain(FAILED)
      return route.fulfill({ response, body: text.replace(FAILED, replacement) })
    }
  )
  return seen
}

/** ลูกค้าใหม่ที่ล็อกอินแล้ว มี cart พร้อมจ่าย และอยู่ขั้น review ด้วย manual payment */
async function reviewWithManual(page: Page, context: BrowserContext, request: APIRequestContext, baseURL: string, variant?: string) {
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL, customer)
  const cartId = await cartReadyForPayment(request, pk, customer, variant ? { variant } : {})
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  await page.goto(`/${CC}/checkout?step=payment`)
  await page.getByTestId(`payment-option-${MANUAL}`).click()
  const submit = page.getByTestId("submit-payment-button")
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByTestId("submit-order-button")).toBeEnabled({ timeout: 15_000 })
  return { customer, cartId }
}

const storeHeaders = (customer: Customer) => ({ authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk })

/** สินค้าใหม่ 1 variant สต็อก 1 ชิ้น คืน variant id */
async function lastPieceProduct(request: APIRequestContext) {
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const run = `${Date.now()}`
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")
  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
      headers: admin,
      data: {
        title: `E2E CORE76 ${run}`,
        handle: `e2e-core76-${run}`,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          {
            title: "M",
            sku: `CORE76-${run}`,
            options: { Size: "M" },
            manage_inventory: true,
            prices: [{ currency_code: "thb", amount: 1000 }],
          },
        ],
      },
    }),
    "create product"
  )
  await ok(
    await request.post(
      `${BACKEND_URL}/admin/inventory-items/${product.variants[0].inventory_items[0].inventory_item_id}/location-levels`,
      { headers: admin, data: { location_id: stock_locations[0].id, stocked_quantity: 1 } }
    ),
    "stock level"
  )
  return product.variants[0].id as string
}

test.describe("AC-175: ผลของการยืนยันคำสั่งซื้อในขั้น review", () => {
  test.setTimeout(180_000)

  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" })
  })

  test("(a) manual: ชิ้นสุดท้ายถูกซื้อไประหว่างอยู่ขั้น review → ข้อความให้ลดจำนวน ไม่มีคำ คืนเงิน", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    const variant = await lastPieceProduct(request)
    await step("ไปขั้น review ด้วย manual payment", async () => {
      await reviewWithManual(page, context, request, baseURL!, variant)
    })
    await step("ลูกค้าอื่นซื้อชิ้นสุดท้ายผ่าน API", async () => {
      await placeOrder(request, pk, await createCustomer(request, pk), { variant })
    })
    await step("กดสั่งซื้อ → INSUFFICIENT_INVENTORY_MESSAGE", async () => {
      await page.getByTestId("submit-order-button").click()
      const error = page.getByTestId("manual-payment-error-message")
      await expect(error).toHaveText(INSUFFICIENT_INVENTORY_MESSAGE, { timeout: 30_000 })
      await expectThai(page, ["manual-payment-error-message"])
      await expect(error).not.toContainText("คืนเงิน")
      await expect(page.getByTestId("checkout-refunded-notice")).toHaveCount(0)
      await evidence("01-manual-out-of-stock")
    })
  })

  test("(a2) 409 กำลัง complete อยู่ แล้ว order มีอยู่ → หน้า order confirmed ภายใน 10 วินาที", async ({
    page,
    context,
    request,
    baseURL,
    step,
  }) => {
    const { customer, cartId } = await reviewWithManual(page, context, request, baseURL!)
    const seen = await mockPlaceOrder(page, cartId, '"kind":"processing"', 1)

    await step("อีก request complete cart นี้ไปแล้ว (เช่น webhook)", async () => {
      const done = await ok(
        await request.post(`${BACKEND_URL}/store/carts/${cartId}/complete`, { headers: storeHeaders(customer) }),
        "complete cart"
      )
      expect(done.type).toBe("order")
    })

    await step("กดสั่งซื้อ → processing แล้วอ่านซ้ำได้ order เดิม → หน้า confirmed", async () => {
      await page.getByTestId("submit-order-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/order/[^/]+/confirmed`), { timeout: 10_000 })
      expect(seen.calls).toBeGreaterThanOrEqual(2)
    })
  })

  test("(a2) 409 กำลัง complete อยู่ และยังไม่มี order → checkout-processing-notice ไม่ใช่ notice คืนเงิน", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    const { cartId } = await reviewWithManual(page, context, request, baseURL!)
    const seen = await mockPlaceOrder(page, cartId, '"kind":"processing"', 100)

    await step("กดสั่งซื้อ → เห็น processing notice และอ่านซ้ำ", async () => {
      await page.getByTestId("submit-order-button").click()
      const notice = page.getByTestId("checkout-processing-notice")
      await expect(notice).toHaveText(PROCESSING_NOTICE, { timeout: 30_000 })
      await expectThai(page, ["checkout-processing-notice"])
      await expect(page.getByTestId("checkout-refunded-notice")).toHaveCount(0)
      await expect(page.getByTestId("submit-order-button")).toBeDisabled()
      await expect.poll(() => seen.calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(2)
      await expect(page).toHaveURL(/\/checkout/)
      await evidence("02-processing-notice")
    })
  })

  test("(a2) 401 (session หมดอายุ) → หน้า login ไม่เห็น notice คืนเงิน", async ({ page, context, request, baseURL, step }) => {
    const { cartId } = await reviewWithManual(page, context, request, baseURL!)
    await mockPlaceOrder(page, cartId, '"kind":"unauthorized"', 1)

    await step("กดสั่งซื้อ → /th/account", async () => {
      await page.getByTestId("submit-order-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/account$`), { timeout: 30_000 })
      await expect(page.getByTestId("checkout-refunded-notice")).toHaveCount(0)
      // CORE-95 (กฎข้อ 151a, AC-192 d): manual ยังไม่ตัดเงิน → URL ไม่มี notice (ด้านบน) และไม่มี notice ได้รับชำระเงิน
      await expect(page.getByTestId("login-payment-received-notice")).toHaveCount(0)
    })
  })
})
