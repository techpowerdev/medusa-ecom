import crypto from "node:crypto"

import { APIRequestContext, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  completeCart,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { continueToReview } from "./support/stripe"

// SFUI-24a: spec 01 AC-201 (กฎข้อ 158a, 158f) — CartTotals เป็นสรุปยอดตัวเดียวของ /cart, ขั้น review, order-completed และ
// รายละเอียดคำสั่งซื้อ: cart-subtotal + cart-shipping − cart-discount + cart-taxes = cart-total = total ของ API (±0.01)
// เคส (i) flash qty 1 (ส่วนลดอัตโนมัติ — ไม่มีแถวส่วนลด) และ (ii) price list sale qty 2 + โค้ด fixed แยกกัน (flash ถูกตัดเมื่อมีโค้ด — ADR-009)
// หาด้วย getByTestId("cart-totals").getByTestId(...) เท่านั้น
test.use({ evidenceTarget: { feature: "r51", taskId: "SFUI-24a" }, viewport: { width: 1280, height: 800 } })

const MANUAL = "pp_system_default"
const BASE = 500
const SALE = 450

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
type Doc = any

const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

/** Σ adjustment ของโค้ดบนฐานของรายการ (สูตรของกฎข้อ 158c = calculateAdjustmentTotal ของ Medusa) */
function codeDiscountOf(doc: Doc, code: string) {
  const onBase = (priced: Doc) => {
    const r = (priced.tax_lines ?? []).reduce((sum: number, t: Doc) => sum + Number(t.rate), 0) / 100
    return (priced.adjustments ?? [])
      .filter((adj: Doc) => adj.code === code)
      .reduce((sum: number, adj: Doc) => {
        const s = adj.is_tax_inclusive ? Number(adj.amount) / (1 + r) : Number(adj.amount)
        return sum + (priced.is_tax_inclusive ? s * (1 + r) : s)
      }, 0)
  }
  return [...doc.items, ...doc.shipping_methods].reduce((sum: number, priced: Doc) => sum + onBase(priced), 0)
}

/** ร้านรวม VAT: ทุก line และ shipping method ของ API เป็น is_tax_inclusive ก่อน assert ว่าไม่มีแถวภาษี */
function expectTaxInclusive(doc: Doc, what: string) {
  for (const priced of [...doc.items, ...doc.shipping_methods]) {
    expect(priced.is_tax_inclusive, `${what}: is_tax_inclusive ของ ${priced.id}`).toBe(true)
  }
}

async function expectTotals(page: Page, doc: Doc, expected: { discount: number | null }, what: string) {
  const totals = page.getByTestId("cart-totals")
  await expect(totals, what).toHaveCount(1)
  await expect(totals).toBeVisible()
  await expect(totals.getByTestId("cart-taxes"), `${what}: ไม่มีแถวภาษี`).toHaveCount(0)
  const discount = totals.getByTestId("cart-discount")
  if (expected.discount === null) {
    await expect(discount, `${what}: ไม่มีแถวส่วนลด`).toHaveCount(0)
  } else {
    expect(Math.abs((await dataValue(discount)) - expected.discount), `${what}: cart-discount`).toBeLessThanOrEqual(0.01)
  }
  const rows =
    (await dataValue(totals.getByTestId("cart-subtotal"))) +
    (await dataValue(totals.getByTestId("cart-shipping"))) -
    ((await discount.count()) ? await dataValue(discount) : 0)
  const grand = await dataValue(totals.getByTestId("cart-total"))
  expect(Math.abs(rows - grand), `${what}: rows=${rows} total=${grand}`).toBeLessThanOrEqual(0.01)
  expect(Math.abs(grand - Number(doc.total)), `${what}: cart-total = total ของ API`).toBeLessThanOrEqual(0.01)
}

async function expectNoOverflow375(page: Page, what: string) {
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByTestId("cart-totals")).toBeVisible()
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `${what}: scrollWidth ที่ 375`).toBeLessThanOrEqual(375)
  await page.setViewportSize({ width: 1280, height: 800 })
}

async function createSaleProduct(request: APIRequestContext, admin: Headers) {
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const handle = `e2e-sfui24a-${Date.now()}-${crypto.randomInt(1e6)}`
  const { product } = await ok(
    await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants`, {
      headers: admin,
      data: {
        title: `E2E ${handle}`,
        handle,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["M"] }],
        variants: [
          { title: "M", options: { Size: "M" }, manage_inventory: false, prices: [{ currency_code: "thb", amount: BASE }] },
        ],
      },
    }),
    "create product"
  )
  const { price_list } = await ok(
    await request.post(`${BACKEND_URL}/admin/price-lists`, {
      headers: admin,
      data: {
        title: `SFUI-24a ${handle}`,
        description: "e2e SFUI-24a sale",
        type: "sale",
        status: "active",
        prices: [{ variant_id: product.variants[0].id, currency_code: "thb", amount: SALE }],
      },
    }),
    "create price list"
  )
  return { productId: product.id as string, variantId: product.variants[0].id as string, priceListId: price_list.id as string }
}

test("AC-201: ทุกหน้าสรุปยอดบวกได้ total ของ API — flash qty 1 และ sale qty 2 + โค้ด (1280 + 375)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(300_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  await signInAs(context, baseURL!, customer)

  const getCart = async (id: string) =>
    (await ok(await request.get(`${BACKEND_URL}/store/carts/${id}`, { headers: store }), "get cart")).cart
  const getOrder = async (id: string) =>
    (await ok(await request.get(`${BACKEND_URL}/store/orders/${id}`, { headers: store }), "get order")).order

  const cleanup: (string | undefined)[] = []
  let campaignId: string | undefined
  try {
    const cases: { name: string; cartId: string; code?: string }[] = []

    await step("Given cart (i) flash qty 1 และ (ii) price list sale qty 2 + โค้ด fixed ฿100 (is_automatic: false)", async () => {
      const flash = await createFlashProduct(request, admin, "SFUI24A", 100)
      cleanup.push(`/admin/products/${flash.productId}`)
      campaignId = await createFlashCampaign(request, admin, "SFUI24A", flash.productId, { total_cap: 100 })
      cases.push({ name: "flash", cartId: await cartReadyForPayment(request, pk, customer, { variant: flash.variantId }) })

      const sale = await createSaleProduct(request, admin)
      cleanup.push(`/admin/price-lists/${sale.priceListId}`, `/admin/products/${sale.productId}`)
      const code = `SFUI24A${Date.now()}${crypto.randomInt(1e6)}`
      const { promotion } = await ok(
        await request.post(`${BACKEND_URL}/admin/promotions`, {
          headers: admin,
          data: {
            code,
            type: "standard",
            status: "active",
            is_automatic: false,
            is_tax_inclusive: true,
            application_method: { type: "fixed", target_type: "order", allocation: "across", value: 100, currency_code: "thb" },
          },
        }),
        "create promotion"
      )
      cleanup.unshift(`/admin/promotions/${promotion.id}`)
      cases.push({
        name: "sale-code",
        code,
        cartId: await cartReadyForPayment(request, pk, customer, { variant: sale.variantId, quantity: 2, promoCode: code }),
      })
    })

    for (const c of cases) {
      const expectedDiscount = (doc: Doc) => (c.code ? codeDiscountOf(doc, c.code) : null)

      await step(`${c.name}: /th/cart`, async () => {
        const cart = await getCart(c.cartId)
        expectTaxInclusive(cart, `${c.name} cart`)
        if (c.code) expect(codeDiscountOf(cart, c.code), "โค้ดมีผลกับ cart").toBeGreaterThan(0.005)
        await context.addCookies([{ name: "_medusa_cart_id", value: c.cartId, url: baseURL! }])
        await page.goto(`/${CC}/cart`)
        await expectTotals(page, cart, { discount: expectedDiscount(cart) }, `${c.name} /cart`)
        await evidence(`${c.name}-01-cart`)
        await expectNoOverflow375(page, `${c.name} /cart`)
      })

      await step(`${c.name}: ขั้น review ของ checkout`, async () => {
        await page.goto(`/${CC}/checkout?step=payment`)
        await page.getByTestId(`payment-option-${MANUAL}`).click()
        await continueToReview(page)
        const cart = await getCart(c.cartId)
        await expectTotals(page, cart, { discount: expectedDiscount(cart) }, `${c.name} review`)
        await expectNoOverflow375(page, `${c.name} review`)
      })

      let orderId = ""
      await step(`${c.name}: order-completed`, async () => {
        orderId = (await completeCart(request, pk, customer, c.cartId)).id
        cleanup.unshift(`POST /admin/orders/${orderId}/cancel`)
        const order = await getOrder(orderId)
        expectTaxInclusive(order, `${c.name} order`)
        await page.goto(`/${CC}/order/${orderId}/confirmed`)
        await expectTotals(page, order, { discount: expectedDiscount(order) }, `${c.name} order-completed`)
        await expectNoOverflow375(page, `${c.name} order-completed`)
      })

      await step(`${c.name}: รายละเอียดคำสั่งซื้อในบัญชี`, async () => {
        const order = await getOrder(orderId)
        await page.goto(`/${CC}/account/orders/details/${orderId}`)
        await expect(page.getByTestId("order-summary").getByTestId("cart-totals")).toBeVisible()
        await expectTotals(page, order, { discount: expectedDiscount(order) }, `${c.name} order details`)
        if (c.code) await evidence(`${c.name}-02-order-details`)
        await expectNoOverflow375(page, `${c.name} order details`)
      })
    }
  } finally {
    if (campaignId) await endFlashCampaign(request, admin, campaignId)
    // ยกเลิก order ก่อน แล้วลบ promotion, price list และสินค้าชั่วคราว — ตรวจ ok() ทุกตัว (กฎข้อ 119)
    await deleteAllThenExpectOk(request, admin, cleanup)
  }
})
