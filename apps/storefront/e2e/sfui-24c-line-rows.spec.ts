import crypto from "node:crypto"

import { APIRequestContext, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { groupBuyOrder } from "./support/group-buy"
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
  variantOf,
} from "./support/medusa"
import { CARD_PROVIDER, HAS_STRIPE_UI, fillCard } from "./support/stripe"

// SFUI-24c: spec 01 AC-202 (กฎข้อ 159) + AC-203 (กฎข้อ 160) — แถวสินค้าของ /cart, preview ของ checkout, dropdown ตะกร้า,
// order-completed และรายละเอียดคำสั่งซื้อ: ไม่มียอดรวมต่อแถว (product-price/product-original-price), ราคาต่อชิ้น × จำนวนทุก qty,
// ขีดฆ่าเฉพาะลดโดยไม่ต้องใส่โค้ด (flash/sale/ซื้อกลุ่ม) และ Σ (ราคาต่อชิ้น × จำนวน) = cart-subtotal ของหน้าเดียวกัน
// ค่าที่คาดคำนวณจาก payload ของ API (ไม่ hardcode ราคา) · หาด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "r51", taskId: "SFUI-24c" }, viewport: { width: 1280, height: 800 } })

const BASE = 500
const SALE = 450

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
type Doc = any

const dataValue = async (el: Locator) => Number(await el.getAttribute("data-value"))

/** ค่าที่คาดของแถวจาก API: ราคาต่อชิ้นหักเฉพาะส่วนลดอัตโนมัติ (code ≠ โค้ดของลูกค้า) และราคาอ้างอิง (กฎข้อ 158c, 159b) */
function expectedRow(item: Doc, customerCode?: string) {
  const r = (item.tax_lines ?? []).reduce((sum: number, t: Doc) => sum + Number(t.rate), 0) / 100
  const automatic = (item.adjustments ?? [])
    .filter((adj: Doc) => adj.code !== customerCode)
    .reduce((sum: number, adj: Doc) => {
      const s = adj.is_tax_inclusive ? Number(adj.amount) / (1 + r) : Number(adj.amount)
      return sum + (item.is_tax_inclusive ? s * (1 + r) : s)
    }, 0)
  const unit = (Number(item.unit_price) * item.quantity - automatic) / item.quantity
  const compareAt = Number(item.compare_at_unit_price ?? 0)
  const reference = compareAt > Number(item.unit_price) + 0.005 ? compareAt : Number(item.unit_price)
  return { unit, reference, quantity: item.quantity as number, reduced: reference - unit > 0.005 }
}

const byCreatedDesc = (items: Doc[]) =>
  [...items].sort((a, b) => ((a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1))

/**
 * ทุกแถวใน `container` ตรงกับ items ของ API (เรียง created_at ใหม่ก่อน แบบเดียวกับหน้า): ไม่มียอดรวมต่อแถว, ราคาต่อชิ้น 1 ตัว,
 * ขีดฆ่าตามกฎข้อ 159b; `quantity` = แสดง product-quantity (ทุกหน้ายกเว้น /cart) · คืน Σ ราคาต่อชิ้น × จำนวน
 */
async function expectRows(container: Locator, rowTestId: string, items: Doc[], customerCode: string | undefined, quantity: boolean) {
  const rows = container.getByTestId(rowTestId)
  await expect(rows).toHaveCount(items.length)
  let sum = 0
  const sorted = byCreatedDesc(items)
  for (let i = 0; i < sorted.length; i++) {
    const row = rows.nth(i)
    const want = expectedRow(sorted[i], customerCode)
    await expect(row.getByTestId("product-price"), `แถว ${i}: ไม่มียอดรวมต่อแถว`).toHaveCount(0)
    await expect(row.getByTestId("product-original-price")).toHaveCount(0)
    await expect(row.getByTestId("product-unit-price")).toHaveCount(1)
    await expect(row.getByTestId("product-unit-price")).toBeVisible()
    const unit = await dataValue(row.getByTestId("product-unit-price"))
    expect(Math.abs(unit - want.unit), `แถว ${i}: ราคาต่อชิ้น ${unit} ≈ ${want.unit}`).toBeLessThanOrEqual(0.01)
    const original = row.getByTestId("product-unit-original-price")
    if (want.reduced) {
      expect(Math.abs((await dataValue(original)) - want.reference), `แถว ${i}: ราคาขีดฆ่า`).toBeLessThanOrEqual(0.01)
    } else {
      await expect(original, `แถว ${i}: ไม่มีราคาขีดฆ่า`).toHaveCount(0)
    }
    if (quantity) await expect(row.getByTestId("product-quantity")).toHaveText(String(want.quantity))
    else await expect(row.getByTestId("product-quantity")).toHaveCount(0)
    sum += unit * want.quantity
  }
  return sum
}

async function expectSumEqualsSubtotal(sum: number, subtotal: Locator, what: string) {
  const value = await dataValue(subtotal)
  expect(Math.abs(sum - value), `${what}: Σ แถว ${sum} = cart-subtotal ${value}`).toBeLessThanOrEqual(0.01)
}

async function at375(page: Page, what: string, body: () => Promise<void>) {
  await page.setViewportSize({ width: 375, height: 812 })
  try {
    await page.reload()
    await body()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${what}: scrollWidth ที่ 375`).toBeLessThanOrEqual(375)
  } finally {
    await page.setViewportSize({ width: 1280, height: 800 })
  }
}

async function createSaleProduct(request: APIRequestContext, admin: Headers) {
  const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const handle = `e2e-sfui24c-${Date.now()}-${crypto.randomInt(1e6)}`
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
        title: `SFUI-24c ${handle}`,
        description: "e2e SFUI-24c sale",
        type: "sale",
        status: "active",
        prices: [{ variant_id: product.variants[0].id, currency_code: "thb", amount: SALE }],
      },
    }),
    "create price list"
  )
  return { productId: product.id as string, variantId: product.variants[0].id as string, priceListId: price_list.id as string }
}

test("AC-202, AC-203: แถวทุกหน้าแสดงราคาต่อชิ้น × จำนวน ขีดฆ่าเฉพาะลดอัตโนมัติ/sale และรายการโค้ดไม่มี promotion อัตโนมัติ (1280 + 375)", async ({
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

    await step("Given cart (i) flash qty 1 และ (ii) sale qty 2 + เสื้อยืด seed qty 1 + โค้ด fixed (is_automatic: false)", async () => {
      const flash = await createFlashProduct(request, admin, "SFUI24C", 100)
      cleanup.push(`/admin/products/${flash.productId}`)
      campaignId = await createFlashCampaign(request, admin, "SFUI24C", flash.productId, { total_cap: 100 })
      cases.push({ name: "flash", cartId: await cartReadyForPayment(request, pk, customer, { variant: flash.variantId }) })

      const sale = await createSaleProduct(request, admin)
      cleanup.push(`/admin/price-lists/${sale.priceListId}`, `/admin/products/${sale.productId}`)
      const code = `SFUI24C${Date.now()}${crypto.randomInt(1e6)}`
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
      const cartId = await cartReadyForPayment(request, pk, customer, { variant: sale.variantId, quantity: 2, promoCode: code })
      const tshirt = (await variantOf(request, pk, "t-shirt")).variantId
      await ok(
        await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, { headers: store, data: { variant_id: tshirt, quantity: 1 } }),
        "add t-shirt"
      )
      cases.push({ name: "sale-code", code, cartId })
    })

    for (const c of cases) {
      await step(`${c.name}: /th/cart (ไม่มีคอลัมน์รวม จำนวนคือ select) + AC-203 รายการโค้ด`, async () => {
        const cart = await getCart(c.cartId)
        if (c.name === "flash") {
          expect(cart.promotions.some((p: Doc) => p.is_automatic), "flash = promotion อัตโนมัติใน cart").toBe(true)
        } else {
          const lines = cart.items.map((item: Doc) => expectedRow(item, c.code))
          expect(lines.filter((l: Doc) => l.reduced), "sale ขีดฆ่า 1 แถว, เสื้อยืด (มีแต่โค้ด) ไม่ขีดฆ่า").toHaveLength(1)
        }
        await context.addCookies([{ name: "_medusa_cart_id", value: c.cartId, url: baseURL! }])
        await page.goto(`/${CC}/cart`)
        const container = page.getByTestId("cart-container")
        const sum = await expectRows(container, "product-row", cart.items, c.code, false)
        await expectSumEqualsSubtotal(sum, page.getByTestId("cart-totals").getByTestId("cart-subtotal"), `${c.name} /cart`)
        // AC-203 (กฎข้อ 160): รายการโค้ดมีเฉพาะโค้ดของลูกค้า
        await expect(page.getByTestId("discount-row")).toHaveCount(c.code ? 1 : 0)
        if (c.code) await expect(page.getByTestId("discount-code")).toContainText(c.code)
        await evidence(`${c.name}-01-cart-rows`)
        await at375(page, `${c.name} /cart`, async () => {
          await expectRows(container, "product-row", cart.items, c.code, false)
        })
      })

      await step(`${c.name}: dropdown ตะกร้า — แถว × จำนวน และ cart-subtotal = Σ แถว`, async () => {
        const cart = await getCart(c.cartId)
        await page.goto(`/${CC}/store`)
        await page.getByTestId("nav-cart-link").hover()
        const dropdown = page.getByTestId("nav-cart-dropdown")
        await expect(dropdown).toBeVisible()
        const sum = await expectRows(dropdown, "cart-item", cart.items, c.code, true)
        await expectSumEqualsSubtotal(sum, dropdown.getByTestId("cart-subtotal"), `${c.name} dropdown`)
        await expect(dropdown.getByTestId("cart-subtotal-label")).toHaveText(/[฀-๿]/)
        await expect(dropdown.getByTestId("cart-subtotal-label")).not.toHaveText(/VAT/)
      })

      await step(`${c.name}: preview ของ checkout`, async () => {
        const cart = await getCart(c.cartId)
        await page.goto(`/${CC}/checkout`)
        const sum = await expectRows(page.getByTestId("items-table"), "product-row", cart.items, c.code, true)
        await expectSumEqualsSubtotal(sum, page.getByTestId("cart-totals").getByTestId("cart-subtotal"), `${c.name} preview`)
        await expect(page.getByTestId("discount-row")).toHaveCount(c.code ? 1 : 0)
        if (c.code) await evidence(`${c.name}-02-checkout-preview`)
      })

      let orderId = ""
      await step(`${c.name}: order-completed และรายละเอียดคำสั่งซื้อ`, async () => {
        orderId = (await completeCart(request, pk, customer, c.cartId)).id
        cleanup.unshift(`POST /admin/orders/${orderId}/cancel`)
        const order = await getOrder(orderId)
        for (const [path, container] of [
          [`/${CC}/order/${orderId}/confirmed`, "order-complete-container"],
          [`/${CC}/account/orders/details/${orderId}`, "order-details-container"],
        ]) {
          await page.goto(path)
          const sum = await expectRows(page.getByTestId(container), "product-row", order.items, c.code, true)
          await expectSumEqualsSubtotal(sum, page.getByTestId("cart-totals").getByTestId("cart-subtotal"), `${c.name} ${path}`)
          await at375(page, `${c.name} ${path}`, async () => {
            await expectRows(page.getByTestId(container), "product-row", order.items, c.code, true)
          })
        }
      })
    }
  } finally {
    if (campaignId) await endFlashCampaign(request, admin, campaignId)
    // ยกเลิก order ก่อน แล้วลบ promotion, price list และสินค้าชั่วคราว — ตรวจ ok() ทุกตัว (กฎข้อ 119)
    await deleteAllThenExpectOk(request, admin, cleanup)
  }
})

test.describe("AC-202 (e): order ของซื้อกลุ่ม — Stripe test mode", () => {
  test.skip(!HAS_STRIPE_UI, "ต้องตั้ง STRIPE_API_KEY (sk_test_) + NEXT_PUBLIC_STRIPE_KEY (pk_test_) ของบัญชีเดียวกัน")

  test("order ซื้อกลุ่มที่จ่ายแล้ว (draft แปลงแล้ว) ในรายละเอียดคำสั่งซื้อ: แถวมีราคาขีดฆ่า และไม่มีแถวส่วนลด (GB = อัตโนมัติ)", async ({
    page,
    context,
    request,
    baseURL,
    step,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const ctx = await groupBuyOrder(request, true)
    await signInAs(context, baseURL!, ctx.customer)
    const store = { authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk }

    await step("จ่ายบัตร 4242 ที่หน้าชำระเงินของ order กลุ่ม จน order-pay-paid (แปลง draft แล้ว)", async () => {
      await page.goto(`/${CC}/account/orders/${ctx.orderId}/pay`)
      await page.getByTestId(`payment-option-${CARD_PROVIDER}`).click()
      await fillCard(page, "4242424242424242")
      await page.getByTestId("order-pay-card-button").click()
      await expect(page.getByTestId("order-pay-paid")).toBeVisible({ timeout: 60_000 })
    })

    await step("รายละเอียดคำสั่งซื้อ: แถวขีดฆ่า unit_price และไม่มี cart-discount", async () => {
      const { order } = await ok(await request.get(`${BACKEND_URL}/store/orders/${ctx.orderId}`, { headers: store }), "get order")
      expect(order.items[0].adjustments.some((adj: Doc) => adj.code?.startsWith("GB-")), "adjustment GB-*").toBe(true)
      await page.goto(`/${CC}/account/orders/details/${ctx.orderId}`)
      const container = page.getByTestId("order-details-container")
      // GB-* นับเป็นอัตโนมัติ (กฎข้อ 158b) — customerCode = undefined → ส่วนลดทั้งหมดลดราคาในแถว
      const sum = await expectRows(container, "product-row", order.items, undefined, true)
      await expect(container.getByTestId("product-unit-original-price")).toHaveCount(order.items.length)
      await expect(page.getByTestId("cart-totals").getByTestId("cart-discount")).toHaveCount(0)
      await expectSumEqualsSubtotal(sum, page.getByTestId("cart-totals").getByTestId("cart-subtotal"), "GB order details")
      await evidence("group-buy-01-order-details")
    })
  })
})
