import crypto from "node:crypto"

import { APIRequestContext, Locator } from "@playwright/test"

import { expectAmountClose, expectAmounts } from "./support/amounts"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  completeCart,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-67: spec 01 AC-166b (กฎข้อ 125, owner สั่งทำ 2026-11-18) — ราคาจาก price list แบบ sale มีราคาขีดฆ่าจาก
// `compare_at_unit_price` ที่ Medusa ตั้งให้ line (500 ไม่ใช่ 450) ใน /cart, preview ของ checkout และ order-completed
// และไม่ซ้อนกับ promotion (ราคาขีดฆ่าตัวเดียวต่อแถว) หาด้วย data-testid เท่านั้น ตัวเลขเทียบผ่าน `support/amounts.ts`
// SFUI-24c (กฎข้อ 159 แทนกฎข้อ 125b–d): แถวแสดงราคาต่อชิ้น × จำนวน — ขีดฆ่า = compare_at_unit_price ต่อชิ้น, ราคาต่อชิ้น = ราคา sale
// (โค้ดของลูกค้าไม่ลดราคาในแถว — อยู่ในบรรทัดส่วนลดของสรุป) ไม่มียอดรวมต่อแถว
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-67" }, viewport: { width: 1280, height: 800 } })

const BASE = 500
const SALE = 450

// fields เดียวกับ storefront: `retrieveCart` (lib/data/cart.ts) และ `retrieveOrder` (lib/data/orders.ts)
const CART_FIELDS =
  "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, +items.requires_shipping, *promotions, +shipping_methods.name"
const ORDER_FIELDS =
  "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product,+items.requires_shipping,*fulfillments,+cart.id,+fulfillments.items.line_item_id"

type Line = { quantity: number; total: number; ref: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ API ใน e2e
function toLine(item: any, what: string): Line {
  // ยืนยันจาก API ก่อน assert UI: Medusa ตั้ง compare_at_unit_price = ราคาฐานเมื่อราคามาจาก price list แบบ sale
  expect(Number(item.compare_at_unit_price), `${what}: compare_at_unit_price`).toBe(BASE)
  expect(Number(item.unit_price), `${what}: unit_price`).toBe(SALE)
  const ref = (Number(item.compare_at_unit_price) * Number(item.original_total)) / Number(item.unit_price)
  expectAmountClose(ref, BASE * item.quantity, `${what}: ref = ราคาฐาน × จำนวน (ราคารวม VAT)`)
  return { quantity: item.quantity, total: Number(item.total), ref }
}

async function cartLine(request: APIRequestContext, store: Headers, cartId: string, what: string) {
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}`, { headers: store, params: { fields: CART_FIELDS } }),
    `get cart ${what}`
  )
  expect(cart.items, `${what}: cart มี 1 line`).toHaveLength(1)
  return toLine(cart.items[0], what)
}

async function orderLine(request: APIRequestContext, store: Headers, orderId: string, what: string) {
  const { order } = await ok(
    await request.get(`${BACKEND_URL}/store/orders/${orderId}`, { headers: store, params: { fields: ORDER_FIELDS } }),
    `get order ${what}`
  )
  expect(order.items, `${what}: order มี 1 line`).toHaveLength(1)
  return toLine(order.items[0], what)
}

/** แถวสินค้าแถวเดียว: ไม่มียอดรวมต่อแถว, ราคาขีดฆ่าต่อชิ้น 1 ตัว = ref ÷ จำนวน (= ราคาฐาน) และราคาต่อชิ้น = ราคา sale */
async function expectRow(container: Locator, line: Line) {
  await expect(container).toBeVisible()
  expect((await container.textContent()) ?? "", "หน้าเป็นภาษาไทย").toMatch(THAI)
  const row = container.getByTestId("product-row")
  await expect(row).toHaveCount(1)
  await expectAmounts(row.getByTestId("product-original-price"), [], "ไม่มี product-original-price")
  await expectAmounts(row.getByTestId("product-price"), [], "ไม่มี product-price")
  const q = line.quantity
  await expectAmounts(row.getByTestId("product-unit-original-price"), [line.ref / q], "unit original = ref / qty")
  await expectAmounts(row.getByTestId("product-unit-price"), [SALE], "unit price = ราคา sale")
}

/** สินค้าชั่วคราว 1 variant ราคาฐาน THB 500 (ไม่ตัด stock) คืน id ของ product/variant */
async function createProduct(request: APIRequestContext, admin: Headers) {
  const { sales_channels } = await ok(
    await request.get(`${BACKEND_URL}/admin/sales-channels?limit=1`, { headers: admin }),
    "sales channels"
  )
  const { shipping_profiles } = await ok(
    await request.get(`${BACKEND_URL}/admin/shipping-profiles?type=default`, { headers: admin }),
    "shipping profiles"
  )
  const handle = `e2e-core67-${Date.now()}-${crypto.randomInt(1e6)}`
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
  return { productId: product.id as string, variantId: product.variants[0].id as string, handle }
}

test("AC-166b: price list แบบ sale แสดงราคาเดิม (compare_at_unit_price) ขีดฆ่าใน /cart, preview และ order-completed ไม่ซ้อนกับ promotion", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(240_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer: Customer = await createCustomer(request, pk)
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  await signInAs(context, baseURL!, customer)

  let productId: string | undefined
  let priceListId: string | undefined
  let promotionId: string | undefined
  const orderIds: string[] = []
  try {
    const carts: Record<string, { id: string; line: Line }> = {}
    await step("Given สินค้าฐาน ฿500 + price list sale ฿450 และ cart S1 (qty 1), S2 (qty 2), SP (sale + promotion 10% qty 1)", async () => {
      const created = await createProduct(request, admin)
      productId = created.productId
      const { price_list } = await ok(
        await request.post(`${BACKEND_URL}/admin/price-lists`, {
          headers: admin,
          data: {
            title: `CORE-67 ${created.handle}`,
            description: "e2e CORE-67 sale",
            type: "sale",
            status: "active",
            prices: [{ variant_id: created.variantId, currency_code: "thb", amount: SALE }],
          },
        }),
        "create price list"
      )
      priceListId = price_list.id

      const code = `CORE67${Date.now()}${crypto.randomInt(1e6)}`
      const { promotion } = await ok(
        await request.post(`${BACKEND_URL}/admin/promotions`, {
          headers: admin,
          data: {
            code,
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: {
              type: "percentage",
              target_type: "items",
              allocation: "each",
              max_quantity: 10,
              value: 10,
            },
          },
        }),
        "create promotion"
      )
      promotionId = promotion.id

      const cases = [
        { name: "S1", quantity: 1, promoCode: undefined },
        { name: "S2", quantity: 2, promoCode: undefined },
        { name: "SP", quantity: 1, promoCode: code },
      ]
      for (const c of cases) {
        const id = await cartReadyForPayment(request, pk, customer, {
          quantity: c.quantity,
          variant: created.variantId,
          promoCode: c.promoCode,
        })
        const line = await cartLine(request, store, id, c.name)
        expect(line.quantity).toBe(c.quantity)
        // S1/S2 ราคาปัจจุบัน = ราคา sale; SP ลดต่อจาก sale ด้วย promotion (ref ยังเป็น 500)
        if (c.promoCode) expect(line.total, "SP: promotion ลดต่อจากราคา sale").toBeLessThan(SALE * c.quantity - 0.005)
        else expectAmountClose(line.total, SALE * c.quantity, `${c.name}: total = ราคา sale × จำนวน`)
        carts[c.name] = { id, line }
      }
    })

    const openCart = (name: string) =>
      context.addCookies([{ name: "_medusa_cart_id", value: carts[name].id, url: baseURL! }])

    for (const name of ["S1", "S2", "SP"]) {
      await step(`(b1)/(b3) /cart ของ ${name} ที่ 1280: ราคาเดิมขีดฆ่าจาก compare_at_unit_price`, async () => {
        await openCart(name)
        await page.goto(`/${CC}/cart`)
        await expectRow(page.getByTestId("cart-container"), carts[name].line)
        if (name === "S2") await evidence("cart-sale-qty2-1280")
      })
    }

    for (const name of ["S1", "S2", "SP"]) {
      await step(`(b2)/(b3) preview ของ checkout ของ ${name}: ราคาต่อชิ้น × จำนวนทุก qty (กฎข้อ 159a)`, async () => {
        await openCart(name)
        await page.goto(`/${CC}/checkout`)
        await expect(page.getByTestId("checkout-summary-heading")).toHaveText(THAI)
        const { line } = carts[name]
        await expectRow(page.getByTestId("items-table"), line)
        await page.getByTestId("items-table").getByTestId("product-row").scrollIntoViewIfNeeded()
        if (name === "SP") await evidence("preview-sale-promo-1280")
      })
    }

    for (const name of ["S1", "SP"]) {
      await step(`(b3)/(b4) order-completed ของ ${name}: ราคาเดิมขีดฆ่า 1 ตัว = ref, ราคา = total`, async () => {
        const { id } = await completeCart(request, pk, customer, carts[name].id)
        orderIds.push(id)
        const line = await orderLine(request, store, id, `order ${name}`)
        await page.goto(`/${CC}/order/${id}/confirmed`)
        await expectRow(page.getByTestId("order-complete-container"), line)
        await page.getByTestId("order-complete-container").getByTestId("product-row").scrollIntoViewIfNeeded()
        if (name === "SP") await evidence("order-sale-promo-1280")
      })
    }
  } finally {
    // (b5) ยกเลิก order ก่อน แล้วลบ promotion, price list และสินค้าชั่วคราว — ตรวจ ok() ทุกตัว (กฎข้อ 119)
    await deleteAllThenExpectOk(request, admin, [
      ...orderIds.map((id) => `POST /admin/orders/${id}/cancel`),
      promotionId && `/admin/promotions/${promotionId}`,
      priceListId && `/admin/price-lists/${priceListId}`,
      productId && `/admin/products/${productId}`,
    ])
  }
})
