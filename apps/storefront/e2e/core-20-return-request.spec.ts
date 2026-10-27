import crypto from "node:crypto"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// CORE-20: spec 01 AC-65 + Q-F5 (owner 2026-10-26) — ลูกค้าขอคืนสินค้าจากหน้า order detail ผ่าน POST /store/returns ของ Medusa
// หา element ด้วย data-testid เท่านั้น ตรวจความเป็นไทยด้วย regex อักษรไทย
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-20" } })

const RETURN_OPTION_TYPE_CODE = "standard-return"

async function fulfillAndShip(request: import("@playwright/test").APIRequestContext, admin: Headers, orderId: string) {
  const { order } = await (
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items`, { headers: admin })
  ).json()
  const items = order.items.map((i: { id: string; quantity: number }) => ({ id: i.id, quantity: i.quantity }))
  const fulfilled = await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments?fields=id,*fulfillments`, {
    headers: admin,
    data: { items },
  })
  expect(fulfilled.status(), await fulfilled.text()).toBe(200)
  const fulfillmentId = (await fulfilled.json()).order.fulfillments[0].id
  const shipped = await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`, {
    headers: admin,
    data: { items },
  })
  expect(shipped.status(), await shipped.text()).toBe(200)
}

test("AC-65: ลูกค้าขอคืนสินค้าจาก order ที่ส่งแล้ว → return requested ใช้ Standard return; order ที่ยังไม่ fulfill ไม่มีปุ่ม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer)
  await signInAs(context, baseURL!, customer)

  // เหตุผลการคืนเป็นของ Medusa (admin สร้าง) — label ไทย
  const reasonRes = await request.post(`${BACKEND_URL}/admin/return-reasons`, {
    headers: admin,
    data: { value: `core20-${Date.now()}-${crypto.randomInt(1e6)}`, label: "ขนาดไม่พอดี" },
  })
  expect(reasonRes.status(), await reasonRes.text()).toBe(200)
  const reasonId: string = (await reasonRes.json()).return_reason.id

  await step("order ที่ยังไม่ fulfill ไม่มีปุ่มขอคืนสินค้า", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-details-container")).toBeVisible()
    await expect(page.getByTestId("order-return-button")).toHaveCount(0)
  })

  await fulfillAndShip(request, admin, order.id)

  await step("order ที่ส่งแล้ว: กดขอคืนสินค้า เลือกจำนวนและเหตุผล", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expectThai(page, ["order-return-button"])
    await page.getByTestId("order-return-button").scrollIntoViewIfNeeded()
    await evidence("01-order-return-button")
    await page.getByTestId("order-return-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders/details/${order.id}/return$`))
    await expectThai(page, ["return-request-heading", "return-submit-button"])
    const row = page.getByTestId("return-item").first()
    await row.getByTestId("return-item-quantity").selectOption("1")
    await row.getByTestId("return-item-reason").selectOption(reasonId)
    await evidence("02-return-form")
  })

  await step("ยืนยัน → ข้อความสำเร็จภาษาไทย", async () => {
    await page.getByTestId("return-submit-button").click()
    await expect(page.getByTestId("order-return-success")).toBeVisible({ timeout: 30_000 })
    await expectThai(page, ["order-return-success"])
    await evidence("03-return-success")
  })

  await step("DB: return requested ของ order นี้ ใช้ Standard return ไม่ถูกรับของทันที และมีเหตุผลที่เลือก", async () => {
    const { shipping_options } = await (
      await request.get(`${BACKEND_URL}/admin/shipping-options?fields=id,*type&limit=100`, { headers: admin })
    ).json()
    const standardReturn = shipping_options.find(
      (o: { type?: { code?: string } }) => o.type?.code === RETURN_OPTION_TYPE_CODE
    )
    expect(standardReturn, "Standard return option").toBeTruthy()

    const { returns } = await (
      await request.get(
        `${BACKEND_URL}/admin/returns?order_id=${order.id}&fields=id,status,received_at,*items,*shipping_methods`,
        { headers: admin }
      )
    ).json()
    expect(returns).toHaveLength(1)
    const [ret] = returns
    expect(ret.status).toBe("requested")
    expect(ret.received_at).toBeNull()
    expect(ret.shipping_methods.map((m: { shipping_option_id: string }) => m.shipping_option_id)).toEqual([
      standardReturn.id,
    ])
    expect(ret.items.map((i: { quantity: number; reason_id: string }) => [i.quantity, i.reason_id])).toEqual([
      [1, reasonId],
    ])
  })

  await step("คืนครบจำนวนแล้ว → ไม่มีปุ่มขอคืนอีก", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-details-container")).toBeVisible()
    await expect(page.getByTestId("order-return-button")).toHaveCount(0)
  })
})

// QA #112 D1 (admin แก้ return_window_days แล้วปุ่มเปลี่ยนทันที, อ่านจาก order.region_id) ย้ายไป core-20c-return-window.spec.ts
// ซึ่งใช้ region แยกของ test แทนการแก้ region "th" ที่ใช้ร่วม (CORE-20c, กฎข้อ 60)
