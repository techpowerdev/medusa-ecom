import { Page } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, fulfillAndShip, placeOrder, publishableKey } from "./support/medusa"

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

test("AC-23: เริ่ม return ผ่าน UI → widget ขึ้นเองในจอแรก; Cancel Return ในหน้า order → หายเองไม่ต้อง reload; reload/order ปกติไม่เห็น", async ({
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
  await step("เริ่ม return ผ่านหน้า Create Return ของ Medusa แล้วปิด (Esc) → กลับหน้า order เห็น widget เองโดยไม่ reload", async () => {
    const created = page.waitForResponse(
      (res) => res.request().method() === "POST" && new URL(res.url()).pathname === "/admin/returns"
    )
    await page.goto(`${BACKEND_URL}/app/orders/${order.id}/returns`)
    const res = await created
    expect(res.status()).toBe(200)
    returnId = (await res.json()).return.id
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`))

    const widget = page.getByTestId(WIDGET)
    await expect(widget).toBeVisible()
    await expect(widget).toContainText("active return")
    await expect(page.getByTestId(`${WIDGET}-types`)).toContainText("return")
  })

  await step("reload → widget อยู่ในจอแรก (1280×720) โดยไม่ต้อง scroll", async () => {
    await openOrder(page, order)
    const widget = page.getByTestId(WIDGET)
    await expect(widget).toBeVisible()
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
