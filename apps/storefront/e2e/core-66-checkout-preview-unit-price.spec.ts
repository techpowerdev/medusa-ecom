import crypto from "node:crypto"

import { APIRequestContext, Page } from "@playwright/test"

import { expectAmounts } from "./support/amounts"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-66: spec 01 AC-165 — SFUI-24c (กฎข้อ 159 แทนกฎข้อ 124; AC-202 (d)): preview ของ checkout (`cart/components/item` type="preview")
// แสดงราคาต่อชิ้น × จำนวนทุก qty ไม่มียอดรวมต่อแถว; โค้ดของลูกค้าไม่ลดราคาในแถว (ไม่มีราคาขีดฆ่า); /cart ไม่มี × n (จำนวนคือ select)
// หาด้วย data-testid เท่านั้น ตัวเลขเทียบหลังตัดอักขระที่ไม่ใช่ตัวเลข/จุด (ส่วนต่าง ≤ การปัด 2 ตำแหน่ง — `support/amounts.ts`) ไม่ match ป้ายข้อความ
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-66" }, viewport: { width: 1280, height: 800 } })

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]

// screenshot สำคัญ ≤ 3 รูป (AC-165f): qty 1 ลด และ qty 2 ลด ที่ 1280 + qty 1 ลด ที่ 375
const EVIDENCE = new Set(["qty1-discount-1280", "qty2-discount-1280", "qty1-discount-375"])

type Line = { quantity: number; total: number; original_total: number }

/** line เดียวของ cart จาก Store API (field ราคาเดียวกับที่ storefront ขอ: `*items`, `+items.total`) */
async function cartLine(request: APIRequestContext, store: Headers, cartId: string): Promise<Line> {
  const { cart } = await ok(
    await request.get(`${BACKEND_URL}/store/carts/${cartId}`, {
      headers: store,
      params: { fields: "*items,+items.total" },
    }),
    "get cart"
  )
  expect(cart.items, "cart มี 1 line").toHaveLength(1)
  const [item] = cart.items
  return { quantity: item.quantity, total: Number(item.total), original_total: Number(item.original_total) }
}

/** ตรวจแถวสินค้าแถวเดียวใน preview ของ checkout (`items-table`) ตามกฎข้อ 159a–b (ส่วนลดของ case เป็นโค้ด) */
async function expectPreviewRow(page: Page, line: Line) {
  await expect(page.getByTestId("checkout-summary-heading")).toHaveText(THAI)
  const row = page.getByTestId("items-table").getByTestId("product-row")
  await expect(row).toHaveCount(1)

  // ไม่มียอดรวมต่อแถว; ราคาต่อชิ้นทุก qty = original_total ÷ จำนวน (โค้ดไม่ลดราคาในแถว) ([] = ไม่มี element ในแถว)
  await expectAmounts(row.getByTestId("product-price"), [], "ไม่มี product-price")
  await expectAmounts(row.getByTestId("product-original-price"), [], "ไม่มี product-original-price")
  await expectAmounts(
    row.getByTestId("product-unit-price"),
    [line.original_total / line.quantity],
    "product-unit-price = original_total / quantity"
  )
  await expectAmounts(row.getByTestId("product-unit-original-price"), [], "โค้ดไม่ทำให้มีราคาขีดฆ่า")
  // "฿<ราคาต่อชิ้น> × <จำนวน>" — จำนวนห่อด้วย product-quantity
  await expect(row.getByTestId("product-quantity")).toHaveText(String(line.quantity))
}

test("AC-165/AC-202 (d): preview ของ checkout — ราคาต่อชิ้น × จำนวนทุก qty ไม่มียอดรวมต่อแถว ที่ 1280 และ 375; /cart ไม่มี × n", async ({
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

  let promotionId: string | undefined
  try {
    const code = `CORE66${Date.now()}${crypto.randomInt(1e6)}`
    const created = await request.post(`${BACKEND_URL}/admin/promotions`, {
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
    })
    expect(created.ok(), `create promotion: ${await created.text()}`).toBe(true)
    promotionId = (await created.json()).promotion.id

    const cases = [
      { name: "qty1-discount", quantity: 1, discounted: true },
      { name: "qty1-plain", quantity: 1, discounted: false },
      { name: "qty2-discount", quantity: 2, discounted: true },
      { name: "qty2-plain", quantity: 2, discounted: false },
    ]
    const carts: Record<string, { id: string; line: Line }> = {}
    await step("Given cart 4 ใบของลูกค้า: {ไม่ลด, ลด 10%} × {qty 1, qty 2}", async () => {
      for (const c of cases) {
        const id = await cartReadyForPayment(request, pk, customer, {
          quantity: c.quantity,
          promoCode: c.discounted ? code : undefined,
        })
        const line = await cartLine(request, store, id)
        expect(line.quantity).toBe(c.quantity)
        expect(line.total < line.original_total, `${c.name}: ลดราคาจริงตาม case`).toBe(c.discounted)
        carts[c.name] = { id, line }
      }
    })

    const openCart = (name: string) =>
      context.addCookies([{ name: "_medusa_cart_id", value: carts[name].id, url: baseURL! }])

    for (const viewport of VIEWPORTS) {
      for (const c of cases) {
        await step(`checkout preview ${c.name} ที่ ${viewport.width}`, async () => {
          await page.setViewportSize(viewport)
          await openCart(c.name)
          await page.goto(`/${CC}/checkout`)
          await expectPreviewRow(page, carts[c.name].line)
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(scrollWidth, "scrollWidth").toBeLessThanOrEqual(viewport.width)
          await page.getByTestId("items-table").getByTestId("product-row").scrollIntoViewIfNeeded()
          if (EVIDENCE.has(`${c.name}-${viewport.width}`)) await evidence(`${c.name}-${viewport.width}`)
        })
      }
    }

    await step("(d) /cart ของ cart qty 1 แบบลด ที่ 1280 มีราคาต่อชิ้น ไม่มียอดรวมต่อแถวและไม่มี × n", async () => {
      await page.setViewportSize(VIEWPORTS[0])
      await openCart("qty1-discount")
      await page.goto(`/${CC}/cart`)
      const row = page.getByTestId("cart-container").getByTestId("product-row")
      await expect(row).toHaveCount(1)
      const { line } = carts["qty1-discount"]
      await expectAmounts(row.getByTestId("product-unit-price"), [line.original_total], "/cart product-unit-price")
      await expectAmounts(row.getByTestId("product-price"), [], "/cart ไม่มี product-price")
      await expect(row.getByTestId("product-quantity")).toHaveCount(0)
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, [promotionId && `/admin/promotions/${promotionId}`])
  }
})
