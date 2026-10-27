import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Customer, Headers, adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-5b (spec 02 AC-19): ปุ่ม resend (data-testid="evoucher-resend") บน order widget ของ EV-6
// order voucher qty 2 วางผ่าน store API ด้วย token ของลูกค้า → admin capture → EV-4 ส่งมอบ 2 code
// admin UI เป็นภาษาอังกฤษ (CLAUDE.md) — หา element ด้วย data-testid
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-5b" } })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
type Json = any

async function call(
  request: APIRequestContext,
  headers: Headers,
  path: string,
  data?: Record<string, unknown>
): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

/** voucher variant (ไม่มี shipping profile) + pool + import 2 code ผ่าน admin API */
async function createVoucher(request: APIRequestContext, admin: Headers): Promise<string> {
  const tag = `ev5b-${Date.now()}`
  const { sales_channels } = await call(request, admin, "/admin/sales-channels?name=Default%20Sales%20Channel")
  const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
  const { product } = await call(request, admin, "/admin/products", {
    title: `EV-5b voucher ${tag}`,
    status: "published",
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Value", values: ["500"] }],
    variants: [
      {
        title: "500 THB",
        options: { Value: "500" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: 500 }],
      },
    ],
  })
  const variantId: string = product.variants[0].id
  const { variant } = await call(
    request,
    admin,
    `/admin/products/${product.id}/variants/${variantId}?fields=inventory_items.inventory_item_id`
  )
  await call(request, admin, `/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`, {
    location_id: stock_locations[0].id,
    stocked_quantity: 0,
  })
  const { partner } = await call(request, admin, "/admin/evoucher/partners", { name: `Partner ${tag}` })
  const { pool } = await call(request, admin, "/admin/evoucher/pools", {
    partner_id: partner.id,
    variant_id: variantId,
    name: `Pool ${tag}`,
    how_to_use: "แสดง code ที่แคชเชียร์",
  })
  const imported = await request.post(`${BACKEND_URL}/admin/evoucher/pools/${pool.id}/import`, {
    headers: admin,
    multipart: {
      file: { name: "codes.csv", mimeType: "text/csv", buffer: Buffer.from(`${tag}-A,1111\n${tag}-B,2222\n`) },
    },
  })
  expect(imported.status(), "import codes").toBe(200)
  return variantId
}

/** cart digital-only (ไม่มีที่อยู่/shipping method, AC-3) → complete → capture โดย admin → payment.captured */
async function placeCapturedOrder(
  request: APIRequestContext,
  admin: Headers,
  pk: string,
  customer: Customer,
  variantId: string
): Promise<string> {
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await call(request, store, "/store/regions")
  const { cart } = await call(request, store, "/store/carts", {
    region_id: regions[0].id,
    email: customer.email,
    items: [{ variant_id: variantId, quantity: 2 }],
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
  return orderId
}

const countDeliveredEmails = async (request: APIRequestContext, admin: Headers, to: string) => {
  const { notifications } = await call(
    request,
    admin,
    `/admin/notifications?channel=email&to=${encodeURIComponent(to)}&limit=50`
  )
  return notifications.filter((n: { template: string }) => n.template === "evoucher.delivered").length
}

test("AC-19: กด Resend email บน widget E-vouchers ของ order → ข้อความสำเร็จและ notification ใหม่ 1 รายการ", async ({
  page,
  request,
  step,
  evidence,
}) => {
  // โหลด admin bundle ครั้งแรกหลัง start (cold) + รอ subscriber ส่งมอบ
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const variantId = await createVoucher(request, admin)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId)

  // EV-4 ส่งมอบแบบ async (subscriber payment.captured)
  await expect
    .poll(
      async () =>
        (await call(request, admin, `/admin/evoucher/orders/${orderId}/codes`)).codes.map(
          (c: { status: string }) => c.status
        ),
      { timeout: 30_000 }
    )
    .toEqual(["delivered", "delivered"])
  expect(await countDeliveredEmails(request, admin, customer.email)).toBe(1)

  const resendPath = `/admin/evoucher/orders/${orderId}/resend`
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === resendPath) posts.push(req.url())
  })

  await step("ล็อกอิน admin แล้วเปิดหน้า order", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    await expect(page.getByTestId("evoucher-resend")).toBeVisible({ timeout: 30_000 })
  })

  await step("dblclick Resend email → POST 1 ครั้ง, toast สำเร็จ และ notification ใหม่ 1 รายการ", async () => {
    await page.getByTestId("evoucher-resend").dblclick()
    await expect(page.getByText("E-voucher email resent with 2 codes")).toBeVisible()
    await evidence("01-resend-success")
    expect(posts).toHaveLength(1)
    await expect.poll(() => countDeliveredEmails(request, admin, customer.email)).toBe(2)
  })
})
