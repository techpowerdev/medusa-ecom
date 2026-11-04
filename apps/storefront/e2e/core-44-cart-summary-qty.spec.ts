import crypto from "node:crypto"

import { Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-44 (spec 01 กฎข้อ 102, AC-138): (a) ที่ ≥ 1024 คอลัมน์สรุปของ /cart ไม่ล้นเมื่อมีโค้ดส่วนลด (กว้าง 360 เท่าเดิม)
// และ product-price ไม่ถูกคอลัมน์สรุปทับ; (b) product-select-button แสดงจำนวนจริงของ line (99) และแก้ลดได้
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-44" } })

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
]
const SUMMARY_WIDTH = 360

/** ตำแหน่งของ cart-summary-column + ทุก product-price (จุดกลางไม่ถูกตัด/ทับ = elementFromPoint อยู่ใน product-price) */
async function measure(page: Page) {
  return page.evaluate(() => {
    const summary = document
      .querySelector('[data-testid="cart-summary-column"]')
      ?.getBoundingClientRect()
    const prices = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="product-price"]')
    ).map((el) => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2
      )
      return { right: r.right, hitInside: !!hit && el.contains(hit) }
    })
    return {
      scrollWidth: document.documentElement.scrollWidth,
      summary: summary && {
        left: summary.left,
        right: summary.right,
        width: summary.width,
      },
      prices,
    }
  })
}

test("AC-138: /cart ที่ 1024/1280 คอลัมน์สรุปไม่ล้นเมื่อมีส่วนลด และตัวเลือกจำนวนแสดง/แก้จำนวนจริง (99 → 2)", async ({
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
  // suffix สุ่ม — worker ที่รันขนาน (เช่น --repeat-each) ได้ Date.now() เดียวกัน
  const runId = `${Date.now()}${crypto.randomInt(1e6)}`
  const code = `CORE44${runId}`
  const created = await request.post(`${BACKEND_URL}/admin/promotions`, {
    headers: admin,
    data: {
      code,
      type: "standard",
      status: "active",
      is_automatic: false,
      application_method: {
        type: "percentage",
        target_type: "order",
        allocation: "across",
        value: 5,
      },
    },
  })
  expect(created.ok(), `create promotion: ${await created.text()}`).toBe(true)
  const promotionId = (await created.json()).promotion.id
  let productId: string | undefined
  try {
    // สินค้าของ test เอง (`manage_inventory: false`) — จำนวน 99 ไม่ขึ้นกับ stock ของ seed (บทเรียน train #280)
    const product = await createTempProduct(admin, runId)
    productId = product.productId
    const [first, ...rest] = product.variantIds

    // cart 1 line จำนวน 99 และ cart 3 line (99 + 2 + 3) — ทั้งคู่ใส่โค้ด 5% (ราคาขีดฆ่า + ราคาลดมีทศนิยม)
    const carts = [
      { lines: [{ variant: first, quantity: 99 }], name: "1line" },
      {
        lines: [
          { variant: first, quantity: 99 },
          { variant: rest[0], quantity: 2 },
          { variant: rest[1], quantity: 3 },
        ],
        name: "3lines",
      },
    ]
    for (const c of carts) {
      await openCart(c.lines)
      for (const viewport of VIEWPORTS) {
        await expectSummaryFits(viewport, c.lines.length, `${c.name}`)
      }
    }

    // (b) ใช้ cart 1 line ใหม่ (จำนวน 99) — select แสดง 99 และเลือก 2 แล้ว backend ได้จำนวน 2
    const { customer, cartId } = await openCart([
      { variant: first, quantity: 99 },
    ])
    await step(
      "product-select-button แสดง 99 และ selectOption(2) → cart ใน backend มีจำนวน 2",
      async () => {
        await page.setViewportSize(VIEWPORTS[0])
        await page.goto(`/${CC}/cart`)
        const select = page.getByTestId("product-select-button")
        await expect(select).toHaveValue("99")
        expect(await select.inputValue()).toBe("99")
        await select.selectOption("2")
        await expect
          .poll(() => lineQuantity(customer, cartId), { timeout: 30_000 })
          .toBe(2)
        await expect(select).toHaveValue("2")
      }
    )
  } finally {
    await deleteAllThenExpectOk(request, admin, [
      `/admin/promotions/${promotionId}`,
      productId && `/admin/products/${productId}`,
    ])
  }

  async function expectSummaryFits(
    viewport: { width: number; height: number },
    lineCount: number,
    name: string
  ) {
    await step(
      `${viewport.width} ${name}: หน้าไม่ล้น, cart-summary-column กว้าง 360 อยู่ในจอ และไม่ทับ product-price`,
      async () => {
        await page.setViewportSize(viewport)
        await page.goto(`/${CC}/cart`)
        await expect(page.getByTestId("product-row")).toHaveCount(lineCount)
        await expect(
          page.getByTestId("product-original-price").first()
        ).toBeVisible()
        await expect(page.getByTestId("cart-summary-column")).toBeVisible()
        const m = await measure(page)
        expect(m.scrollWidth).toBeLessThanOrEqual(viewport.width)
        expect(m.summary).toBeDefined()
        expect(m.summary!.right).toBeLessThanOrEqual(viewport.width)
        expect(Math.abs(m.summary!.width - SUMMARY_WIDTH)).toBeLessThanOrEqual(1)
        expect(m.prices.length).toBe(lineCount)
        for (const p of m.prices) {
          expect(p.right).toBeLessThanOrEqual(m.summary!.left)
          expect(p.hitInside, "จุดกลางของ product-price ไม่ถูกตัด/ทับ").toBe(
            true
          )
        }
        if (viewport.width === 1024) await evidence(`01-cart-1024-${name}`)
      }
    )
  }

  /** cart ใหม่ของลูกค้าใหม่ (Store API ด้วย token ของเจ้าของ) + โค้ด 5% แล้วตั้ง cookie ให้ browser */
  async function openCart(lines: { variant: string; quantity: number }[]) {
    const customer = await createCustomer(request, pk)
    const headers = storeHeaders(customer)
    const [head, ...others] = lines
    const cartId = await cartReadyForPayment(request, pk, customer, head)
    for (const line of others) {
      const res = await request.post(
        `${BACKEND_URL}/store/carts/${cartId}/line-items`,
        { headers, data: { variant_id: line.variant, quantity: line.quantity } }
      )
      expect(res.ok(), `add line item: ${res.status()}`).toBe(true)
    }
    const applied = await request.post(
      `${BACKEND_URL}/store/carts/${cartId}/promotions`,
      { headers, data: { promo_codes: [code] } }
    )
    expect(applied.ok(), `apply promotion: ${applied.status()}`).toBe(true)
    await context.clearCookies()
    await signInAs(context, baseURL!, customer)
    await context.addCookies([
      { name: "_medusa_cart_id", value: cartId, url: baseURL! },
    ])
    return { customer, cartId }
  }

  function storeHeaders(customer: Customer): Headers {
    return {
      authorization: `Bearer ${customer.token}`,
      "x-publishable-api-key": pk,
    }
  }

  async function lineQuantity(customer: Customer, cartId: string) {
    const res = await request.get(
      `${BACKEND_URL}/store/carts/${cartId}?fields=*items`,
      { headers: storeHeaders(customer) }
    )
    expect(res.ok(), `get cart: ${res.status()}`).toBe(true)
    const { cart } = await res.json()
    return cart.items[0].quantity as number
  }

  /** เสื้อชั่วคราว 3 ขนาด ราคา 590 THB (`manage_inventory: false`) ชื่อเดียวกับ t-shirt ของ seed */
  async function createTempProduct(admin: Headers, runId: string) {
    const get = async (path: string) =>
      (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get(
      "/admin/shipping-profiles?type=default"
    )
    const handle = `e2e-core44-${runId}`
    const sizes = ["M", "L", "XL"]
    const res = await request.post(
      `${BACKEND_URL}/admin/products?fields=id,*variants`,
      {
        headers: admin,
        data: {
          title: "เสื้อยืด Medusa",
          handle,
          status: "published",
          shipping_profile_id: shipping_profiles[0].id,
          sales_channels: [{ id: sales_channels[0].id }],
          options: [{ title: "Size", values: sizes }],
          variants: sizes.map((size) => ({
            title: size,
            sku: `${handle}-${size}`.toUpperCase(),
            options: { Size: size },
            manage_inventory: false,
            prices: [{ currency_code: "thb", amount: 590 }],
          })),
        },
      }
    )
    expect(res.ok(), `create product: ${await res.text()}`).toBe(true)
    const { product } = await res.json()
    const bySize = (size: string) =>
      product.variants.find((v: { title: string }) => v.title === size)
        .id as string
    return {
      productId: product.id as string,
      variantIds: sizes.map(bySize),
    }
  }
})
