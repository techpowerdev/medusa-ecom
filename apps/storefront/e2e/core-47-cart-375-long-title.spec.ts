import crypto from "node:crypto"

import { Page } from "@playwright/test"

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
import { addToCartFromPdp, waitForServerAction } from "./support/server-action"
import { THAI } from "./support/thai-text"

// CORE-47 (spec 01 กฎข้อ 105, AC-142): /cart ที่ < 1024 แต่ละ line เป็นการ์ด — ชื่อสินค้ายาว (~90 ตัว ไทยปนอังกฤษ) ใช้ความกว้าง
// ทางขวาของรูปทั้งหมด, บรรทัดล่างปุ่มลบ/จำนวน + ยอด 7 หลักพร้อมราคาขีดฆ่าชิดขวาไม่ถูกตัด; ≥ 1024 ตารางเดิม; `type="preview"` ไม่เปลี่ยน
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-47" } })

const MOBILE = { width: 375, height: 812 }
const EDGE = { width: 1023, height: 800 }
const REGRESSION = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
]
// ค่าเดียวกับ DESKTOP_BASELINE ของ core-42-cart-voucher-layout.spec.ts:84–88 (กฎข้อ 100a) — คัดลอกเพราะ import ไฟล์ spec จะลงทะเบียน test ของไฟล์นั้นซ้ำ
const DESKTOP_BASELINE = {
  header: ["0px/16px", "16px/16px", "16px/16px", "16px/16px", "16px/0px"],
  row: ["0px/16px", "16px/16px", "16px/16px", "16px/16px", "16px/0px"],
  quantityBoxWidth: 112,
}
// ชื่อคงที่ 85–95 ตัว (ตรวจใน test) — แบบที่ qa #287 O-1 ใช้
const TITLES = [
  "เสื้อยืดคอกลม Premium Organic Cotton Oversize Unisex รุ่นพิเศษ Limited Edition สีกรมท่าเข้มมาก",
  "กระเป๋าเป้สะพายหลัง Waterproof Laptop Backpack ขนาด 15.6 นิ้ว รุ่น Travel Professional ช่องเยอะ",
]
const UNIT_PRICE = 12345.67
const QUANTITIES = [99, 11]
// testid ของกฎข้อ 105c ที่ line ของ test มี (ไม่มี error) — ต้องมี 1 ตัวต่อแถวใน DOM (รวมตัวที่ซ่อน)
const ROW_TEST_IDS = [
  "product-title",
  "product-variant",
  "product-delete-button",
  "product-select-button",
  "product-unit-price",
  "product-price",
  "product-original-price",
]

type TempProduct = { productId: string; handle: string; variantId: string }

/** การ์ดแต่ละแถวที่ < small: ตำแหน่งของชื่อ/ตัวเลือก/ราคา/ปุ่ม + จำนวนบรรทัด (ชื่อ: height/lineHeight, ตัวเลข: Range.getClientRects) */
async function measureCards(page: Page) {
  return page.evaluate(() => {
    const centre = (el: Element) => {
      // ชื่อยาวทำให้แถวสูง — เลื่อนเฉพาะแนวตั้งให้ element อยู่กลางจอก่อน elementFromPoint (ไม่เลื่อนแนวนอน ไม่ซ่อนการล้น)
      const box = el.getBoundingClientRect()
      window.scrollTo(0, window.scrollY + box.top + box.height / 2 - window.innerHeight / 2)
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, hitInside: !!hit && el.contains(hit) }
    }
    const number = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return { text: el.textContent ?? "", ...centre(el), lines: range.getClientRects().length }
    }
    return Array.from(document.querySelectorAll('[data-testid="product-row"]')).map((row) => {
      const one = (id: string) => row.querySelector(`[data-testid="${id}"]`)!
      const title = one("product-title")
      const lineHeight = parseFloat(getComputedStyle(title).lineHeight)
      const t = centre(title)
      // bottom ของ product-variant/top ของ price/select/delete เทียบในแถวเดียวกัน — วัดหลัง scroll ครั้งเดียว (ไม่ปน scroll ของ centre)
      const tops = () => ({
        variantBottom: one("product-variant").getBoundingClientRect().bottom,
        price: one("product-price").getBoundingClientRect().top,
        select: one("product-select-button").getBoundingClientRect().top,
        delete: one("product-delete-button").getBoundingClientRect().top,
      })
      return {
        counts: Object.fromEntries(
          Array.from(new Set(Array.from(row.querySelectorAll("[data-testid]")).map((el) => el.getAttribute("data-testid")!))).map(
            (id) => [id, row.querySelectorAll(`[data-testid="${id}"]`).length]
          )
        ),
        rowWidth: row.getBoundingClientRect().width,
        rowRight: row.getBoundingClientRect().right,
        title: {
          text: title.textContent ?? "",
          right: t.right,
          width: t.width,
          lineHeight,
          lines: Math.round(title.getBoundingClientRect().height / lineHeight),
        },
        prices: [number(one("product-price")), number(one("product-original-price"))],
        select: centre(one("product-select-button")),
        deleteButton: centre(one("product-delete-button")),
        tops: tops(),
      }
    })
  })
}

/** layout ตารางที่ ≥ small: display ของแถว/cell, padding (แบบ core-42 `desktopLayout`), ความกว้างกล่องจำนวนและลิงก์รูป */
async function tableLayout(page: Page) {
  return page.evaluate(() => {
    const padding = (el: Element) => `${getComputedStyle(el).paddingLeft}/${getComputedStyle(el).paddingRight}`
    const header = document.querySelector('[data-testid="cart-items-header"]')!
    const rows = Array.from(document.querySelectorAll('[data-testid="product-row"]'))
    const first = rows[0]
    return {
      rowDisplays: rows.map((row) => getComputedStyle(row).display),
      cellDisplays: rows.flatMap((row) => Array.from(row.querySelectorAll("td")).map((td) => getComputedStyle(td).display)),
      layout: {
        header: Array.from(header.querySelectorAll("th")).map(padding),
        row: Array.from(first.querySelectorAll("td")).map(padding),
        quantityBoxWidth: first
          .querySelector('[data-testid="product-select-button"]')!
          .closest("td")!.firstElementChild!.getBoundingClientRect().width,
      },
      imageLinkWidth: first.querySelector("td a")!.getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
}

test("AC-142: /cart < 1024 เป็นการ์ด ชื่อยาว ~90 ตัวอ่านได้ ยอด 7 หลักไม่ถูกตัด, ≥ 1024 ตารางเดิม, preview ไม่เปลี่ยน", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(240_000)
  for (const title of TITLES) {
    expect(title.length).toBeGreaterThanOrEqual(85)
    expect(title.length).toBeLessThanOrEqual(95)
    expect(title).toMatch(THAI)
    expect(title).toMatch(/[A-Za-z]{4,}/)
  }
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  // suffix สุ่ม — worker ที่รันขนาน (เช่น --repeat-each) ได้ Date.now() เดียวกัน
  const runId = `${Date.now()}${crypto.randomInt(1e6)}`
  const code = `CORE47${runId}`
  const productIds: string[] = []
  let promotionId: string | undefined
  try {
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
    expect(created.ok(), `create promotion: ${await created.text()}`).toBe(
      true
    )
    promotionId = (await created.json()).promotion.id
    // สินค้าของ test เอง (`manage_inventory: false`) — จำนวน 99/11 ไม่ขึ้นกับ stock ของ seed
    const products: TempProduct[] = []
    for (let i = 0; i < TITLES.length; i++) {
      const product = await createTempProduct(admin, TITLES[i], `${runId}-${i}`)
      productIds.push(product.productId)
      products.push(product)
    }

    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const headers = storeHeaders(customer)
    let cartId = ""
    const lineIds: string[] = []
    /** line ของ cart ตาม Store API (token ของเจ้าของ cart) */
    const lines = async (): Promise<{ id: string; quantity: number }[]> => {
      const { cart } = await ok(
        await request.get(
          `${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`,
          { headers }
        ),
        "get cart"
      )
      return cart.items
    }

    await step(
      "เพิ่มสินค้าทั้งสองจาก PDP แล้วตั้งจำนวน 99/11 + โค้ด 5% ผ่าน Store API (token ของเจ้าของ cart)",
      async () => {
        await page.setViewportSize(MOBILE)
        for (const product of products) {
          await page.goto(`/${CC}/products/${product.handle}`)
          await addToCartFromPdp(page, { request, pk, customer })
        }
        cartId =
          (await context.cookies()).find((c) => c.name === "_medusa_cart_id")
            ?.value ?? ""
        expect(cartId, "cart cookie").toBeTruthy()
        const { cart } = await ok(
          await request.get(
            `${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`,
            { headers }
          ),
          "get cart"
        )
        for (let i = 0; i < products.length; i++) {
          const product = products[i]
          const line = cart.items.find(
            (item: { variant_id: string }) =>
              item.variant_id === product.variantId
          )
          expect(line, `line ของ ${product.handle}`).toBeTruthy()
          lineIds.push(line.id)
          await ok(
            await request.post(
              `${BACKEND_URL}/store/carts/${cartId}/line-items/${line.id}`,
              { headers, data: { quantity: QUANTITIES[i] } }
            ),
            "update line item"
          )
        }
        await ok(
          await request.post(
            `${BACKEND_URL}/store/carts/${cartId}/promotions`,
            { headers, data: { promo_codes: [code] } }
          ),
          "apply promotion"
        )
      }
    )

    await step(
      "(a) 375: การ์ด — ชื่อใช้ความกว้างทางขวาของรูป ≤ 5 บรรทัด, บรรทัดล่างปุ่มลบ/จำนวน/รวมชิดขวาไม่ถูกตัด, หน้าไม่ล้น",
      async () => {
        await page.setViewportSize(MOBILE)
        await openCart()
        const cards = await measureCards(page)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth)
        ).toBeLessThanOrEqual(MOBILE.width)
        expect(cards.map((c) => c.title.text).sort()).toEqual([...TITLES].sort())
        // ยอด 7 หลัก: line จำนวน 99 = ฿1,222,221.33 ก่อนลด
        const amounts = cards.flatMap((c) =>
          c.prices.map((p) => Number(p.text.replace(/[^\d.]/g, "")))
        )
        expect(Math.max(...amounts)).toBeGreaterThanOrEqual(1_000_000)
        for (const c of cards) {
          const name = c.title.text.slice(0, 12)
          for (const id of ROW_TEST_IDS) {
            expect(c.counts[id], `${name}: ${id} 1 ตัวต่อแถว`).toBe(1)
          }
          for (const [id, count] of Object.entries(c.counts)) {
            expect(count, `${name}: ${id} ไม่ซ้ำในแถว`).toBe(1)
          }
          expect(c.title.right, `${name}: title right`).toBeLessThanOrEqual(MOBILE.width)
          expect(c.title.width, `${name}: ช่องชื่อ ≥ 60% ของแถว`).toBeGreaterThanOrEqual(0.6 * c.rowWidth)
          expect(Number.isFinite(c.title.lineHeight), "lineHeight เป็นตัวเลข").toBe(true)
          expect(c.title.lines, `${name}: ชื่อ ≤ 5 บรรทัด`).toBeLessThanOrEqual(5)
          for (const p of c.prices) {
            expect(p.left, `${p.text} left`).toBeGreaterThanOrEqual(0)
            expect(p.right, `${p.text} right`).toBeLessThanOrEqual(MOBILE.width)
            expect(p.hitInside, `จุดกลางของ ${p.text} ไม่ถูกตัด/ทับ`).toBe(true)
            expect(p.lines, `${p.text} ไม่ถูกตัดบรรทัด`).toBe(1)
          }
          expect(
            Math.max(...c.prices.map((p) => p.right)),
            `${name}: รวมชิดขวา`
          ).toBeGreaterThanOrEqual(c.rowRight - 2)
          for (const key of ["price", "select", "delete"] as const) {
            expect(c.tops[key], `${name}: ${key} อยู่บรรทัดล่าง`).toBeGreaterThanOrEqual(
              c.tops.variantBottom - 1
            )
          }
          expect(c.select.hitInside, `${name}: select ไม่ถูกทับ`).toBe(true)
          expect(c.deleteButton.hitInside, `${name}: ปุ่มลบไม่ถูกทับ`).toBe(true)
        }
        // หัวคอลัมน์ไม่มีความหมายในการ์ด (กฎข้อ 105b)
        await expect(page.getByTestId("cart-items-header")).not.toBeVisible()
        await page.evaluate(() => window.scrollTo(0, 0))
        await evidence("01-cart-375-card")
      }
    )

    await step("(c) 1023: ขอบ breakpoint ยังเป็นการ์ด หน้าไม่ล้น", async () => {
      await page.setViewportSize(EDGE)
      await openCart()
      const { rowDisplays, scrollWidth } = await tableLayout(page)
      for (const display of rowDisplays) expect(display).not.toBe("table-row")
      expect(scrollWidth).toBeLessThanOrEqual(EDGE.width)
    })

    for (const viewport of REGRESSION) {
      await step(
        `(d) ${viewport.width}: ตารางเดิม — header 5 ช่อง, padding = DESKTOP_BASELINE, กล่องจำนวน 112, รูป 96`,
        async () => {
          await page.setViewportSize(viewport)
          await openCart()
          await expect(page.getByTestId("cart-summary-column")).toBeVisible()
          const header = page.getByTestId("cart-items-header")
          await expect(header.locator("th")).toHaveCount(5)
          for (let i = 0; i < 5; i++) {
            await expect(header.locator("th").nth(i)).toBeVisible()
          }
          for (const row of await page.getByTestId("product-row").all()) {
            await expect(row.getByTestId("product-unit-price")).toBeVisible()
          }
          const t = await tableLayout(page)
          expect(t.rowDisplays).toEqual(TITLES.map(() => "table-row"))
          expect(t.cellDisplays).toEqual(
            t.cellDisplays.map(() => "table-cell")
          )
          expect(t.cellDisplays).toHaveLength(TITLES.length * 5)
          expect(t.layout).toEqual(DESKTOP_BASELINE)
          expect(t.imageLinkWidth).toBe(96)
          expect(t.scrollWidth).toBeLessThanOrEqual(viewport.width)
          if (viewport.width === 1280) await evidence("02-cart-1280-table")
        }
      )
    }

    await step(
      "(e) 375: สรุปตะกร้าใน checkout (type=preview) ยังเป็นแถวตาราง",
      async () => {
        await page.setViewportSize(MOBILE)
        await page.goto(`/${CC}/checkout`)
        const rows = page.getByTestId("items-table").getByTestId("product-row")
        await expect(rows).toHaveCount(TITLES.length)
        for (const row of await rows.all()) {
          expect(
            await row.evaluate((el) => getComputedStyle(el).display)
          ).toBe("table-row")
        }
      }
    )

    await step(
      "(b) 375: แก้จำนวนและลบจากการ์ดได้ (Store API ตรงกัน)",
      async () => {
        await page.setViewportSize(MOBILE)
        await openCart()
        const row = page
          .getByTestId("product-row")
          .filter({ has: page.getByTestId("product-title").getByText(TITLES[1], { exact: true }) })
        await expect(row).toHaveCount(1)
        const updated = waitForServerAction(page, (body) =>
          body.includes(lineIds[1])
        )
        await row.getByTestId("product-select-button").selectOption("2")
        expect((await updated).status(), "server action ของ updateLineItem").toBe(200)
        await expect(row.getByTestId("product-select-button")).toHaveValue("2")
        await expect
          .poll(async () => (await lines()).find((l) => l.id === lineIds[1])?.quantity)
          .toBe(2)
        const removed = waitForServerAction(page, (body) =>
          body.includes(lineIds[1])
        )
        await row.getByTestId("product-delete-button").click()
        expect((await removed).status(), "server action ของ deleteLineItem").toBe(200)
        await expect(page.getByTestId("product-row")).toHaveCount(1)
        await expect.poll(async () => (await lines()).length).toBe(1)
      }
    )
  } finally {
    await deleteAllThenExpectOk(request, admin, [
      promotionId && `/admin/promotions/${promotionId}`,
      ...productIds.map((id) => `/admin/products/${id}`),
    ])
  }

  async function openCart() {
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(TITLES.length)
    await expect(page.getByTestId("product-original-price")).toHaveCount(
      TITLES.length
    )
  }

  function storeHeaders(customer: Customer): Headers {
    return {
      authorization: `Bearer ${customer.token}`,
      "x-publishable-api-key": pk,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
  async function ok(res: Awaited<ReturnType<typeof request.get>>, what: string): Promise<any> {
    expect(res.ok(), `${what}: ${res.status()} ${await res.text()}`).toBe(true)
    return res.json()
  }

  /** สินค้าชั่วคราว 1 variant ราคา ฿12,345.67 (`manage_inventory: false`) — PDP เลือก variant เดียวให้เอง */
  async function createTempProduct(
    admin: Headers,
    title: string,
    suffix: string
  ): Promise<TempProduct> {
    const get = async (path: string) =>
      (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get(
      "/admin/shipping-profiles?type=default"
    )
    const handle = `e2e-core47-${suffix}`
    const res = await request.post(
      `${BACKEND_URL}/admin/products?fields=id,handle,*variants`,
      {
        headers: admin,
        data: {
          title,
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
              prices: [{ currency_code: "thb", amount: UNIT_PRICE }],
            },
          ],
        },
      }
    )
    expect(res.ok(), `create product: ${await res.text()}`).toBe(true)
    const { product } = await res.json()
    return {
      productId: product.id as string,
      handle,
      variantId: product.variants[0].id as string,
    }
  }
})
