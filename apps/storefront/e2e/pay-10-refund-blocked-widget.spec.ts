import { APIRequestContext, Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders, createCustomer, fulfillAndShip, ok, placeOrder, publishableKey } from "./support/medusa"

// PAY-10 (spec 06 กฎข้อ 12, AC-23): widget เตือนว่า refund ถูกกันเมื่อ order มี order change ค้าง (pending/requested — ค่าเดียวกับ
// middleware ของ PAY-8) ไม่แตะปุ่ม Refund ของ Medusa; order ไม่ต้องจ่ายด้วย Stripe (widget ดูแค่ order change) จึงใช้ manual payment ของ seed
// review/qa #471: widget ต้องตามสถานะบนหน้าเดียวกัน (เริ่ม/ยกเลิก return ผ่าน UI ของ Medusa โดยไม่ reload) และอยู่ในจอแรก (เหนือ Payments)
// ปุ่ม/route ของหน้า order เป็นของ @medusajs/dashboard (ใส่ data-testid ไม่ได้) จึงหาด้วย role + ชื่อจาก i18n ของ Medusa — widget ของเราใช้ data-testid
test.use({ ...ADMIN_UI_OPTIONS, viewport: { width: 1280, height: 720 }, evidenceTarget: { feature: "payments", taskId: "PAY-10" } })

const WIDGET = "order-refund-blocked"

type Order = { id: string; displayId: number }

/**
 * เปิดหน้า order แล้วรอ `GET /admin/orders/:id/preview` (ข้อมูลที่ widget และหน้า order ของ Medusa ใช้ร่วมกันผ่าน `useOrderPreview`)
 * ตอบ 200 และหน้า order render แล้ว (heading = display id) — ตรวจ "ไม่เห็น widget" หลังจากนี้เสมอ จึงไม่ผ่านหลอกเพราะยังไม่ render/หน้า crash
 */
async function openOrder(page: Page, order: Order) {
  const preview = page.waitForResponse((res) => new URL(res.url()).pathname === `/admin/orders/${order.id}/preview`, {
    timeout: 30_000,
  })
  await page.goto(`${BACKEND_URL}/app/orders/${order.id}`)
  expect((await preview).status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1, name: `#${order.displayId}`, exact: true })).toBeVisible()
}

/** return request ที่ค้างจริง (ยังไม่ confirm) ผ่าน admin API — เส้นทางเดียวกับ PAY-8 integration */
async function requestReturn(request: APIRequestContext, admin: Headers, orderId: string): Promise<string> {
  const { order } = await ok(
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items`, { headers: admin }),
    "admin order"
  )
  const created = await ok(
    await request.post(`${BACKEND_URL}/admin/returns`, { headers: admin, data: { order_id: orderId } }),
    "create return"
  )
  await ok(
    await request.post(`${BACKEND_URL}/admin/returns/${created.return.id}/request-items`, {
      headers: admin,
      data: { items: [{ id: order.items[0].id, quantity: 1 }] },
    }),
    "request return items"
  )
  return created.return.id
}

test("AC-23: เริ่ม return ผ่าน UI → widget ขึ้นเอง, ปิดฟอร์ม/Cancel Return → หายเองไม่ต้อง reload; return ค้างอยู่ในจอแรก; reload/order ปกติไม่เห็น", async ({
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

  // hotfix (develop แดงหลัง #471): หน้า Create Return ของ Medusa ยกเลิก return request เมื่อปิดฟอร์มโดยไม่ submit
  // (`RouteFocusModal.Form` onClose → `cancelReturnRequest`, order-create-return-NNDQSKD3.mjs:947-951) แต่เฉพาะเมื่อฟอร์ม mount แล้ว —
  // test เดิมกด Esc แข่งกับการ mount ฟอร์ม จึงบางครั้ง return ถูกยกเลิก (widget หายถูกต้อง) แล้ว step reload ล้ม
  // → รอสัญญาณที่แน่นอน: ฟอร์ม mount (heading "Create Return") ก่อนตรวจ widget และรอ DELETE ของการยกเลิกก่อนตรวจว่า widget หาย
  await step("เริ่ม return ผ่านหน้า Create Return ของ Medusa → widget บนหน้า order (ใต้ modal) ขึ้นเองโดยไม่ reload", async () => {
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === "/admin/returns"
    )
    await page.goto(`${BACKEND_URL}/app/orders/${order.id}/returns`)
    expect((await created).status()).toBe(200)
    await expect(page.getByRole("heading", { level: 1, name: "Create Return" })).toBeVisible()
    const widget = page.getByTestId(WIDGET)
    await expect(widget).toBeAttached()
    await expect(widget).toContainText("active return")
    await expect(page.getByTestId(`${WIDGET}-types`)).toContainText("return request")
  })

  await step("ปิดฟอร์ม (Esc) → Medusa ยกเลิก return request → widget หายเองโดยไม่ reload", async () => {
    const canceled = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && /^\/admin\/returns\/[^/]+\/request$/.test(new URL(res.url()).pathname)
    )
    await page.keyboard.press("Escape")
    expect((await canceled).status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`))
    await expect(page.getByRole("heading", { level: 1, name: `#${order.displayId}`, exact: true })).toBeVisible()
    await expect(page.getByTestId(WIDGET)).toHaveCount(0)
  })

  let returnId = ""
  await step("return request ค้าง (admin API) → เปิดหน้า order → widget อยู่ในจอแรก (1280×720) โดยไม่ต้อง scroll", async () => {
    returnId = await requestReturn(request, admin, order.id)
    await openOrder(page, order)
    const widget = page.getByTestId(WIDGET)
    await expect(widget).toBeVisible()
    await expect(widget).toContainText("active return")
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(widget).toBeInViewport({ ratio: 1 })
    await widget.scrollIntoViewIfNeeded()
    await evidence("01-order-refund-blocked")
  })

  await step("กด Cancel Return ในแผงของ Medusa (ไม่ reload) → widget หายเอง", async () => {
    const canceled = page.waitForResponse(
      (res) => res.request().method() === "DELETE" && new URL(res.url()).pathname === `/admin/returns/${returnId}/request`
    )
    await page.getByRole("button", { name: "Cancel Return" }).click()
    expect((await canceled).status()).toBe(200)
    await expect(page.getByRole("button", { name: "Cancel Return" })).toHaveCount(0)
    await expect(page.getByTestId(WIDGET)).toHaveCount(0)
  })

  await step("reload หลังยกเลิก return → ไม่เห็น widget", async () => {
    await openOrder(page, order)
    await expect(page.getByTestId(WIDGET)).toHaveCount(0)
  })
})
