import crypto from "node:crypto"

import { Page } from "@playwright/test"

import { STORE_CONTENT } from "../src/lib/store-content"
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
import { THAI } from "./support/thai-text"

// CORE-50 (spec 01 กฎข้อ 108, AC-145): nav ที่ < 1024 ตั้งแต่ 320 — ปุ่มเมนู/ชื่อร้าน/ไอคอนค้นหา/"ตะกร้า (n)" ไม่ชิด/ทับกัน
// ห่างกัน ≥ 8px อยู่ในจอ, ชื่อร้านและ "ตะกร้า (116)" บรรทัดเดียวไม่ถูกตัด, header สูง 64; ≥ 1024 เหมือนเดิม (ค่าที่วัดบน develop 1743eb7)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-50" } })

const NARROW = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 639, height: 812 },
  { width: 1023, height: 800 },
]
const DESKTOP = { width: 1280, height: 800 }
const QUANTITY = 116
const ORDER = ["nav-menu-button", "nav-store-link", "nav-search-button", "nav-cart-link"] as const
// วัดบน develop 1743eb7 (nav/styles เท่า a349676) ที่ 1280×800 (cart 116 ชิ้น) — left/width ของทั้ง 4 ตัว (กฎข้อ 108d: class `small:` เดิมไม่เปลี่ยน)
// platform: chromium ของ image mcr.microsoft.com/playwright:v1.64.1-noble (Linux แบบ CI ubuntu-latest) — macOS render ข้อความไทยกว้างต่างไป ~1.3px
// จึงต้องเทียบบน Linux (รันบน macOS ส่วน 1280 อาจล้ม)
const DESKTOP_BASELINE: Record<(typeof ORDER)[number], { left: number; width: number }> = {
  "nav-menu-button": { left: 24, width: 17 },
  "nav-store-link": { left: 591, width: 98 },
  "nav-search-button": { left: 1107, width: 15 },
  "nav-cart-link": { left: 1195, width: 61 },
}

/** ตำแหน่งของทั้ง 4 ตัว + จำนวนบรรทัดของข้อความ (Range.getClientRects) + การล้นของชื่อร้าน/หน้า และความสูงของ header */
async function measureNav(page: Page) {
  return page.evaluate((ids) => {
    const lines = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return range.getClientRects().length
    }
    const items = ids.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`) as HTMLElement
      const r = el.getBoundingClientRect()
      return { id, left: r.left, right: r.right, width: r.width, lines: lines(el), text: el.textContent ?? "" }
    })
    const store = document.querySelector('[data-testid="nav-store-link"]') as HTMLElement
    return {
      items,
      storeScroll: { scrollWidth: store.scrollWidth, clientWidth: store.clientWidth },
      pageScrollWidth: document.documentElement.scrollWidth,
      headerHeight: document.querySelector("header")!.getBoundingClientRect().height,
    }
  }, [...ORDER])
}

test.describe("AC-145: nav ที่ < 1024 ตั้งแต่ 320", () => {
  let admin: Headers
  let customer: Customer
  let productId: string | undefined
  let cartId = ""

  test.beforeAll(async ({ request }) => {
    admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    // suffix สุ่ม — worker ที่รันขนานได้ Date.now() เดียวกัน
    const handle = `e2e-core50-${Date.now()}${crypto.randomInt(1e6)}`
    const get = async (path: string) => (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
    // สินค้าของ test เอง (`manage_inventory: false`) — จำนวน 116 ไม่ขึ้นกับ stock ของ seed
    const created = await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants`, {
      headers: admin,
      data: {
        title: "สินค้าทดสอบ nav แคบ",
        handle,
        status: "published",
        shipping_profile_id: shipping_profiles[0].id,
        sales_channels: [{ id: sales_channels[0].id }],
        options: [{ title: "Size", values: ["Free"] }],
        variants: [
          {
            title: "Free",
            sku: handle.toUpperCase(),
            options: { Size: "Free" },
            manage_inventory: false,
            prices: [{ currency_code: "thb", amount: 100 }],
          },
        ],
      },
    })
    expect(created.ok(), `create product: ${await created.text()}`).toBe(true)
    const { product } = await created.json()
    productId = product.id

    // cart ของ A ผ่าน Store API (token ของ A)
    customer = await createCustomer(request, pk)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const regions = await request.get(`${BACKEND_URL}/store/regions`, { headers })
    expect(regions.ok(), `store regions: ${regions.status()}`).toBe(true)
    const region = (await regions.json()).regions.find((r: { countries: { iso_2: string }[] }) =>
      r.countries.some((c) => c.iso_2 === CC)
    )
    const cart = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
    expect(cart.ok(), `create cart: ${await cart.text()}`).toBe(true)
    cartId = (await cart.json()).cart.id
    const line = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
      headers,
      data: { variant_id: product.variants[0].id, quantity: QUANTITY },
    })
    expect(line.ok(), `add line item: ${await line.text()}`).toBe(true)
  })

  test.afterAll(async ({ request }) => {
    await deleteAllThenExpectOk(request, admin, [productId && `/admin/products/${productId}`])
  })

  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  })

  async function openHome(page: Page) {
    await page.goto(`/${CC}`)
    await expect(page.getByTestId("nav-cart-link")).toHaveText(`ตะกร้า (${QUANTITY})`)
  }

  for (const viewport of NARROW) {
    test(`${viewport.width}×${viewport.height}: ไม่ทับกัน ห่าง ≥ 8px บรรทัดเดียว ชื่อร้านครบ header 64`, async ({
      page,
      step,
      evidence,
    }) => {
      await page.setViewportSize(viewport)
      await openHome(page)
      await step(`วัด nav ที่ ${viewport.width}`, async () => {
        const m = await measureNav(page)
        const [menu, store, search, cart] = m.items
        expect(cart.text).toMatch(/^ตะกร้า \(116\)$/)
        expect(cart.text).toMatch(THAI)
        for (let i = 1; i < m.items.length; i++) {
          const left = m.items[i - 1]
          const right = m.items[i]
          expect(right.left - left.right, `ระยะ ${left.id} → ${right.id}`).toBeGreaterThanOrEqual(8)
        }
        for (const item of m.items) {
          expect(item.left, `${item.id} left`).toBeGreaterThanOrEqual(0)
          expect(item.right, `${item.id} right`).toBeLessThanOrEqual(viewport.width)
        }
        expect(cart.lines, "nav-cart-link บรรทัดเดียว").toBe(1)
        expect(store.lines, "nav-store-link บรรทัดเดียว").toBe(1)
        expect(store.text).toBe(STORE_CONTENT.name)
        expect(m.storeScroll.scrollWidth, "ชื่อร้านไม่ถูกตัด").toBeLessThanOrEqual(m.storeScroll.clientWidth)
        expect(m.pageScrollWidth, "หน้าไม่ล้นแนวนอน").toBeLessThanOrEqual(viewport.width)
        expect(m.headerHeight).toBe(64)
        expect(menu.width).toBeGreaterThan(0)
        expect(search.width).toBeGreaterThan(0)
      })
      if (viewport.width === 320) await evidence("01-nav-320")
    })
  }

  test("1280×800: ชื่อร้านกึ่งกลาง nav-account-link แสดง ตำแหน่ง/ขนาดเท่า develop", async ({ page, evidence }) => {
    await page.setViewportSize(DESKTOP)
    await openHome(page)
    await expect(page.getByTestId("nav-account-link")).toBeVisible()
    const m = await measureNav(page)
    const store = m.items[1]
    expect(Math.abs(store.left + store.width / 2 - DESKTOP.width / 2)).toBeLessThanOrEqual(1)
    for (const item of m.items) {
      const base = DESKTOP_BASELINE[item.id as (typeof ORDER)[number]]
      expect(Math.abs(item.left - base.left), `${item.id} left`).toBeLessThanOrEqual(1)
      expect(Math.abs(item.width - base.width), `${item.id} width`).toBeLessThanOrEqual(1)
    }
    expect(m.headerHeight).toBe(64)
    await evidence("02-nav-1280")
  })
})
