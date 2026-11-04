import crypto from "node:crypto"

import { APIRequestContext, Page } from "@playwright/test"

import { INSUFFICIENT_INVENTORY_MESSAGE } from "../src/lib/util/insufficient-inventory"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { isServerAction } from "./support/server-action"
import { THAI } from "./support/thai-text"

// CORE-48 (spec 01 กฎข้อ 106, AC-143): แก้จำนวนบน /cart เกิน stock → Medusa 2.22.1 ตอบ 400 `insufficient_inventory`
// → `product-error-message` แสดง INSUFFICIENT_INVENTORY_MESSAGE, select กลับเป็นจำนวนจริง (Medusa ไม่แก้ line)
// แล้วแก้จำนวนที่มี stock → error หาย; ที่ 375 error อยู่ในการ์ดของ line นั้น (layout ของ CORE-47)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-48" } })

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]
const STOCK = 5

/** body ของ `updateLineItem({ lineId, quantity })` — หน้า /cart ยิง action อื่นเองได้ จึงเลือกจาก argument */
const isUpdateBody = (quantity: number) => (body: string) => {
  try {
    const [arg] = JSON.parse(body)
    return typeof arg?.lineId === "string" && arg?.quantity === quantity
  } catch {
    return false
  }
}

/** เลือกจำนวนแล้วรอ server action ของ updateLineItem ตอบจริง — ก่อน hydrate เสร็จ selectOption เปลี่ยนแค่ DOM จึงเลือกซ้ำ (review #287) */
async function selectQuantity(page: Page, quantity: number) {
  const select = page.getByTestId("product-select-button")
  await expect(async () => {
    const updated = page.waitForResponse(
      (res) => isServerAction(res.request(), isUpdateBody(quantity)),
      { timeout: 5_000 }
    )
    await select.selectOption(String(quantity))
    expect((await updated).status(), "server action ของ updateLineItem").toBe(200)
  }).toPass()
}

/** error อยู่ภายใน product-row (การ์ดที่ 375) และอยู่ในจอ ไม่ทำให้หน้าล้น */
async function errorPlacement(page: Page) {
  return page.evaluate(() => {
    const error = document.querySelector('[data-testid="product-error-message"]')!
    const row = document.querySelector('[data-testid="product-row"]')!
    const e = error.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    return {
      insideRow: row.contains(error),
      withinRow: e.left >= r.left - 0.5 && e.right <= r.right + 0.5 && e.top >= r.top - 0.5 && e.bottom <= r.bottom + 0.5,
      right: e.right,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
}

for (const viewport of VIEWPORTS) {
  test(`AC-143: ${viewport.width}×${viewport.height} แก้จำนวนเกิน stock → ข้อความไทยว่าสินค้าไม่พอ, จำนวนคงเดิม แล้วแก้ได้`, async ({
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
    // suffix สุ่ม — worker ที่รันขนาน (--repeat-each) ได้ Date.now() เดียวกัน
    const runId = `${Date.now()}${crypto.randomInt(1e6)}`
    let productId: string | undefined
    try {
      const product = await createStockedProduct(request, admin, runId)
      productId = product.productId
      const customer = await createCustomer(request, pk)
      const headers = storeHeaders(pk, customer)
      const cartId = await createCart(request, headers, product.variantId)

      await context.clearCookies()
      await signInAs(context, baseURL!, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      await page.setViewportSize(viewport)

      const select = page.getByTestId("product-select-button")
      const error = page.getByTestId("product-error-message")

      await step(`เลือก 10 (stock ${STOCK}) → product-error-message เป็นข้อความไทยว่าสินค้าไม่พอ และจำนวนคง 1`, async () => {
        await page.goto(`/${CC}/cart`)
        await expect(page.getByTestId("product-row")).toHaveCount(1)
        await expect(select).toHaveValue("1")
        await selectQuantity(page, 10)
        await expect(error).toBeVisible()
        await expect(error).toHaveText(INSUFFICIENT_INVENTORY_MESSAGE)
        expect(await error.textContent()).toBe(INSUFFICIENT_INVENTORY_MESSAGE)
        expect(await error.textContent()).toMatch(THAI)
        await expect(select).toHaveValue("1")
        expect(await select.inputValue()).toBe("1")
        expect(await lineQuantity(request, headers, cartId)).toBe(1)
        const placement = await errorPlacement(page)
        expect(placement.insideRow, "error อยู่ใน product-row").toBe(true)
        expect(placement.withinRow, "error อยู่ในกรอบของแถว/การ์ด").toBe(true)
        expect(placement.right).toBeLessThanOrEqual(viewport.width)
        expect(placement.scrollWidth).toBeLessThanOrEqual(viewport.width)
        await evidence(`0${VIEWPORTS.indexOf(viewport) + 1}-cart-${viewport.width}-insufficient-stock`)
      })

      await step("เลือก 3 (มี stock) → error หาย และจำนวนใน backend = 3", async () => {
        await selectQuantity(page, 3)
        await expect(error).toHaveCount(0)
        await expect
          .poll(() => lineQuantity(request, headers, cartId), { message: "จำนวนของ line ตาม Store API" })
          .toBe(3)
        await expect(select).toHaveValue("3")
      })
    } finally {
      await deleteAllThenExpectOk(request, admin, [productId && `/admin/products/${productId}`])
    }
  })
}

function storeHeaders(pk: string, customer: Customer): Headers {
  return { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
}

async function lineQuantity(request: APIRequestContext, headers: Headers, cartId: string) {
  const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=*items`, { headers })
  expect(res.ok(), `get cart: ${res.status()}`).toBe(true)
  const { cart } = await res.json()
  return cart.items[0].quantity as number
}

/** cart ใหม่ของลูกค้า (token ของเจ้าของ) region ไทย + สินค้าของ test จำนวน 1 */
async function createCart(request: APIRequestContext, headers: Headers, variantId: string) {
  const regionsRes = await request.get(`${BACKEND_URL}/store/regions`, { headers })
  expect(regionsRes.ok(), `regions: ${regionsRes.status()}`).toBe(true)
  const { regions } = await regionsRes.json()
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const created = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
  expect(created.ok(), `create cart: ${await created.text()}`).toBe(true)
  const { cart } = await created.json()
  const added = await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
    headers,
    data: { variant_id: variantId, quantity: 1 },
  })
  expect(added.ok(), `add line item: ${await added.text()}`).toBe(true)
  return cart.id as string
}

/** สินค้าของ test เอง `manage_inventory: true` stock 5 ที่ location ของ seed (ไม่ขึ้นกับ stock ของสินค้า seed) */
async function createStockedProduct(request: APIRequestContext, admin: Headers, runId: string) {
  const get = async (path: string) => {
    const res = await request.get(`${BACKEND_URL}${path}`, { headers: admin })
    expect(res.ok(), `${path}: ${res.status()}`).toBe(true)
    return res.json()
  }
  const post = async (path: string, data: object) => {
    const res = await request.post(`${BACKEND_URL}${path}`, { headers: admin, data })
    expect(res.ok(), `${path}: ${await res.text()}`).toBe(true)
    return res.json()
  }
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const { stock_locations } = await get("/admin/stock-locations?limit=1")
  const handle = `e2e-core48-${runId}`
  const { product } = await post("/admin/products?fields=id,*variants,*variants.inventory_items", {
    title: "เสื้อยืด Medusa",
    handle,
    status: "published",
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Size", values: ["M"] }],
    variants: [
      {
        title: "M",
        sku: `${handle}-M`.toUpperCase(),
        options: { Size: "M" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: 590 }],
      },
    ],
  })
  const variant = product.variants[0]
  await post(`/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`, {
    location_id: stock_locations[0].id,
    stocked_quantity: STOCK,
  })
  return { productId: product.id as string, variantId: variant.id as string }
}
