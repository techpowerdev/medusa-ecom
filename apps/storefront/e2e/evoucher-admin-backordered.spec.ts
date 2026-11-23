import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { backorderedItems, call, createVoucher, Json, placeCapturedOrder, setVariantStock } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-22 (spec 02 กฎข้อ 38, AC-52): line ที่ code ไม่พอตอน capture (backordered) เห็น badge บน widget E-vouchers ของหน้า order
// stock ของ variant B ถูกตั้งเกินจำนวน code (stock คลาดเคลื่อน) → order B qty 2 ผ่าน checkout แต่ claim ได้ไม่ครบ
// การล้างธงหลัง allocation สำเร็จพิสูจน์ใน integration-tests/http/evoucher-allocate.spec.ts (admin ไม่มีปุ่มสั่ง allocate ซ้ำ)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-22" } })

const variantIds = (items: Json[]) => items.map((i) => i.variant_id)

test("AC-52: order ที่มี line backordered 1 line → widget แสดง evoucher-backordered-badge 1 ตัว", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const a = await createVoucher(request, admin, 1)
  const b = await createVoucher(request, admin, 1)

  await setVariantStock(request, admin, b.handle, 2)

  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await call(request, store, "/store/regions")
  const { cart } = await call(request, store, "/store/carts", {
    region_id: regions[0].id,
    email: customer.email,
    items: [
      { variant_id: a.variantId, quantity: 1 },
      { variant_id: b.variantId, quantity: 2 },
    ],
  })
  const { payment_collection } = await call(request, store, "/store/payment-collections", { cart_id: cart.id })
  await call(request, store, `/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    provider_id: "pp_system_default",
  })
  const done = await call(request, store, `/store/carts/${cart.id}/complete`, {})
  expect(done.type, JSON.stringify(done)).toBe("order")
  const orderId: string = done.order.id
  const { order } = await call(request, admin, `/admin/orders/${orderId}?fields=*payment_collections.payments`)
  await call(request, admin, `/admin/payments/${order.payment_collections[0].payments[0].id}/capture`, {})

  // EV-4 ทำงานแบบ async (subscriber payment.captured): line A ได้ code, line B ถูก mark — ธงต้องมาทาง Admin API (กฎข้อ 38a)
  await expect
    .poll(() => backorderedItems(request, admin, orderId).then(variantIds), { timeout: 30_000 })
    .toEqual([b.variantId])

  await step("เปิดหน้า order → badge backordered 1 ตัว และตาราง code มี 1 แถว (line A)", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    const widget = page.getByTestId("evoucher-order-widget")
    await expect(widget.getByTestId("evoucher-backordered-badge")).toHaveCount(1, { timeout: 30_000 })
    await expect(widget.locator("tbody tr")).toHaveCount(1)
    await widget.scrollIntoViewIfNeeded()
    await evidence("01-backordered-badge")
  })
})

// qa #446 (session หลักตัดสิน 2026-11-21): order ที่ยกเลิกแล้วยังมีธงค้าง (ไม่ล้างตอน cancel) แต่ไม่ต้องรอ code → ไม่ขึ้น badge
test("AC-52: order ที่ยกเลิกแล้วแม้ line ยังมีธง backordered → ไม่มี evoucher-backordered-badge", async ({
  page,
  request,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const voucher = await createVoucher(request, admin, 1)
  await setVariantStock(request, admin, voucher.handle, 2)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, voucher.variantId, 2)
  await expect
    .poll(() => backorderedItems(request, admin, orderId).then(variantIds), { timeout: 30_000 })
    .toEqual([voucher.variantId])
  await call(request, admin, `/admin/orders/${orderId}/cancel`, {})
  const { order } = await call(request, admin, `/admin/orders/${orderId}?fields=status`)
  expect(order.status).toBe("canceled")
  expect(await backorderedItems(request, admin, orderId).then(variantIds)).toEqual([voucher.variantId])

  await step("เปิดหน้า order ที่ยกเลิกแล้ว → ไม่มี badge backordered (ไม่มี code → ไม่มี widget)", async () => {
    await loginAdmin(page)
    // widget mount แล้วยิงอ่าน code ของ order — รอคำตอบนั้นแทนการหา element ด้วยข้อความ
    const codesLoaded = page.waitForResponse(
      (res) => new URL(res.url()).pathname === `/admin/evoucher/orders/${orderId}/codes` && res.ok(),
      { timeout: 30_000 }
    )
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    await codesLoaded
    await expect(page.getByTestId("evoucher-backordered-badge")).toHaveCount(0)
    await expect(page.getByTestId("evoucher-order-widget")).toHaveCount(0)
  })
})
