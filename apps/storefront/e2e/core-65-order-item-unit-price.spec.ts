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
  createCustomer,
  ok,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-65: spec 01 AC-164 — SFUI-24c (กฎข้อ 159 แทนกฎข้อ 123; AC-202 (d)): แถวสินค้าของ order แสดงราคาต่อชิ้น × จำนวนทุก qty
// ไม่มียอดรวมต่อแถว และโค้ดส่วนลดของลูกค้าไม่ลดราคาในแถว (อยู่ในบรรทัดส่วนลดของสรุป) — ไม่มีราคาขีดฆ่า;
// `Item` ตัวเดียวกันใช้ทั้ง order-completed และ account order details
// หาด้วย data-testid เท่านั้น ตัวเลขเทียบหลังตัดอักขระที่ไม่ใช่ตัวเลข/จุด ไม่ match ป้ายข้อความ
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-65" }, viewport: { width: 1280, height: 800 } })

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]

// screenshot สำคัญ ≤ 4 รูป (AC-164f): qty 1 ลด/ไม่ลด และ qty 2 ลด ที่ 1280 + qty 1 ลด ที่ 375
const EVIDENCE = new Set(["qty1-discount-1280", "qty1-plain-1280", "qty2-discount-1280", "qty1-discount-375"])

type Line = { quantity: number; total: number; original_total: number }

async function orderLine(request: APIRequestContext, store: Headers, orderId: string): Promise<Line> {
  const { order } = await ok(
    await request.get(`${BACKEND_URL}/store/orders/${orderId}`, { headers: store }),
    "get order"
  )
  expect(order.items, "order มี 1 line").toHaveLength(1)
  const [item] = order.items
  return { quantity: item.quantity, total: Number(item.total), original_total: Number(item.original_total) }
}

/** ตรวจแถวสินค้าแถวเดียวภายใน container ตามกฎข้อ 159a–b (ส่วนลดของ case เป็นโค้ด → ไม่ลดราคาในแถว) */
async function expectRow(page: Page, containerId: string, line: Line) {
  const container = page.getByTestId(containerId)
  await expect(container).toBeVisible()
  expect((await container.textContent()) ?? "", "หน้าเป็นภาษาไทย").toMatch(THAI)
  const row = container.getByTestId("product-row")
  await expect(row).toHaveCount(1)

  await expect(row.getByTestId("product-quantity")).toHaveText(String(line.quantity))
  // ไม่มียอดรวมต่อแถว; ราคาต่อชิ้นทุก qty = original_total ÷ จำนวน (โค้ดไม่ลดราคาในแถว) ([] = ไม่มี element ในแถว)
  await expectAmounts(row.getByTestId("product-price"), [], "ไม่มี product-price")
  await expectAmounts(row.getByTestId("product-original-price"), [], "ไม่มี product-original-price")
  await expectAmounts(
    row.getByTestId("product-unit-price"),
    [line.original_total / line.quantity],
    "product-unit-price = original_total / quantity"
  )
  await expectAmounts(row.getByTestId("product-unit-original-price"), [], "โค้ดไม่ทำให้มีราคาขีดฆ่า")
}

test("AC-164/AC-202 (d): แถวสินค้าของ order — ราคาต่อชิ้น × จำนวนทุก qty ไม่มียอดรวมต่อแถว ที่ 1280 และ 375", async ({
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
  // CORE-66 (กฎข้อ 124e): order ที่สร้างถูกยกเลิกใน finally (ก่อนลบ promotion) — เก็บ id ทันทีที่สร้าง
  const orderIds: string[] = []
  try {
    const code = `CORE65${Date.now()}${crypto.randomInt(1e6)}`
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
    const orders: Record<string, { id: string; line: Line }> = {}
    await step("Given order 4 ใบ: {ไม่ลด, ลด 10%} × {qty 1, qty 2}", async () => {
      for (const c of cases) {
        const { id } = await placeOrder(request, pk, customer, {
          quantity: c.quantity,
          promoCode: c.discounted ? code : undefined,
        })
        orderIds.push(id)
        const line = await orderLine(request, store, id)
        expect(line.quantity).toBe(c.quantity)
        expect(line.total < line.original_total, `${c.name}: ลดราคาจริงตาม case`).toBe(c.discounted)
        orders[c.name] = { id, line }
      }
    })

    for (const viewport of VIEWPORTS) {
      for (const c of cases) {
        await step(`order-completed ${c.name} ที่ ${viewport.width}`, async () => {
          await page.setViewportSize(viewport)
          await page.goto(`/${CC}/order/${orders[c.name].id}/confirmed`)
          await expectRow(page, "order-complete-container", orders[c.name].line)
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
          expect(scrollWidth, "scrollWidth").toBeLessThanOrEqual(viewport.width)
          await page.getByTestId("order-complete-container").getByTestId("product-row").scrollIntoViewIfNeeded()
          if (EVIDENCE.has(`${c.name}-${viewport.width}`)) await evidence(`${c.name}-${viewport.width}`)
        })
      }
    }

    await step("(d) /account/orders/details ของ order qty 1 แบบลด ที่ 1280 เป็นไปตามกฎข้อ 159", async () => {
      await page.setViewportSize(VIEWPORTS[0])
      await page.goto(`/${CC}/account/orders/details/${orders["qty1-discount"].id}`)
      await expectRow(page, "order-details-container", orders["qty1-discount"].line)
    })
  } finally {
    await deleteAllThenExpectOk(request, admin, [
      ...orderIds.map((id) => `POST /admin/orders/${id}/cancel`),
      promotionId && `/admin/promotions/${promotionId}`,
    ])
  }
})
