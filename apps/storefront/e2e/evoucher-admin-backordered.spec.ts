import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call, createVoucher, Json } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-22 (spec 02 กฎข้อ 38, AC-52): line ที่ code ไม่พอตอน capture (backordered) เห็น badge บน widget E-vouchers ของหน้า order
// stock ของ variant B ถูกตั้งเกินจำนวน code (stock คลาดเคลื่อน) → order B qty 2 ผ่าน checkout แต่ claim ได้ไม่ครบ
// การล้างธงหลัง allocation สำเร็จพิสูจน์ใน integration-tests/http/evoucher-allocate.spec.ts (admin ไม่มีปุ่มสั่ง allocate ซ้ำ)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-22" } })

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

  const { products } = await call(
    request,
    admin,
    `/admin/products?handle=${b.handle}&fields=variants.inventory_items.inventory_item_id`
  )
  const inventoryItemId: string = products[0].variants[0].inventory_items[0].inventory_item_id
  const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
  await call(request, admin, `/admin/inventory-items/${inventoryItemId}/location-levels/${stock_locations[0].id}`, {
    stocked_quantity: 2,
  })

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
    .poll(
      async () => {
        const { order } = await call(request, admin, `/admin/orders/${orderId}?fields=*items`)
        return order.items
          .filter((i: Json) => i.metadata?.evoucher_backordered === true)
          .map((i: Json) => i.variant_id)
      },
      { timeout: 30_000 }
    )
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
