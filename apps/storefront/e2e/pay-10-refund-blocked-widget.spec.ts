import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders, createCustomer, fulfillAndShip, ok, placeOrder, publishableKey } from "./support/medusa"

// PAY-10 (spec 06 กฎข้อ 12, AC-23): widget `order.details.before` เตือนว่า refund ถูกกันเมื่อ order มี order change ค้าง
// (pending/requested — ค่าเดียวกับ middleware ของ PAY-8) ไม่แตะปุ่ม Refund ของ Medusa; order ไม่ต้องจ่ายด้วย Stripe
// (widget ดูแค่ order change) จึงใช้ manual payment ของ seed
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "payments", taskId: "PAY-10" } })

const WIDGET = "order-refund-blocked"

/**
 * เปิดหน้า order แล้วรอ request order change ของ widget (`status` = pending/requested) และของ timeline ของ Medusa
 * (`change_type`) ตอบ 200 แล้วหน้า order ยัง render ได้ (heading = display id) — ไม่เห็น widget จึงแปลว่าไม่มี change ค้างจริง
 * ไม่ใช่หน้า crash (useOrderChanges ของ dashboard ใช้ queryKey เดียวโดยไม่รวม query → cache ชนกับ timeline แล้ว crash)
 */
async function openOrder(page: Page, order: { id: string; displayId: number }) {
  const changes = (marker: string) =>
    page.waitForResponse((res) => res.url().includes(`/admin/orders/${order.id}/changes`) && res.url().includes(marker), {
      timeout: 30_000,
    })
  const widget = changes("status")
  const timeline = changes("change_type")
  await page.goto(`${BACKEND_URL}/app/orders/${order.id}`)
  expect((await widget).status()).toBe(200)
  expect((await timeline).status()).toBe(200)
  await expect(page.getByRole("heading", { name: `#${order.displayId}` })).toBeVisible()
}

async function requestReturn(request: APIRequestContext, admin: Headers, orderId: string): Promise<string> {
  const { order } = await ok(
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items`, { headers: admin }),
    "admin order"
  )
  const created = await ok(
    await request.post(`${BACKEND_URL}/admin/returns`, { headers: admin, data: { order_id: orderId } }),
    "create return"
  )
  const returnId: string = created.return.id
  await ok(
    await request.post(`${BACKEND_URL}/admin/returns/${returnId}/request-items`, {
      headers: admin,
      data: { items: [{ id: order.items[0].id, quantity: 1 }] },
    }),
    "request return items"
  )
  return returnId
}

test("AC-23: order ที่มี return request ค้างเห็น widget เตือน refund ถูกกัน; ยกเลิก return แล้ว reload ไม่เห็น; order ปกติไม่เห็น", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer)
  // ขอคืนได้เฉพาะ line ที่ส่งแล้ว
  await fulfillAndShip(request, admin, order.id)
  await loginAdmin(page)

  await step("order ปกติ (ไม่มี order change ค้าง) → ไม่เห็น widget", async () => {
    await openOrder(page, order)
    await expect(page.getByTestId(WIDGET)).toHaveCount(0)
  })

  let returnId = ""
  await step("admin สร้าง return request (ยังไม่ confirm) → reload → เห็น widget เตือน + ชนิด change", async () => {
    returnId = await requestReturn(request, admin, order.id)
    await openOrder(page, order)
    const widget = page.getByTestId(WIDGET)
    await expect(widget).toBeVisible()
    await expect(widget).toContainText("active return")
    await expect(page.getByTestId(`${WIDGET}-types`)).toContainText("return")
    await evidence("01-order-refund-blocked")
  })

  await step("ยกเลิก return request แล้ว reload → ไม่เห็น widget", async () => {
    const res = await request.delete(`${BACKEND_URL}/admin/returns/${returnId}/request`, { headers: admin })
    expect(res.ok(), `cancel return request: ${res.status()} ${await res.text()}`).toBe(true)
    await openOrder(page, order)
    await expect(page.getByTestId(WIDGET)).toHaveCount(0)
  })
})
