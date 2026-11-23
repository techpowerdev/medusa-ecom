import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { call, createVoucher, Json, placeCapturedOrder, waitDelivered } from "./support/evoucher"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { Headers, adminHeaders, createCustomer, publishableKey } from "./support/medusa"

// EV-24 (spec 02 กฎข้อ 40, AC-54): ปุ่ม "Retry allocation" (evoucher-retry-allocation) บน widget E-vouchers ของหน้า order
// order backordered: pool ว่าง + stock คลาดเคลื่อน (stock 1 ไม่มี code) → checkout ผ่านแต่ claim ไม่ได้ตอน capture (แบบ EV-22)
test.use({ ...ADMIN_UI_OPTIONS, evidenceTarget: { feature: "evoucher", taskId: "EV-24" } })

const setStock = async (request: APIRequestContext, admin: Headers, handle: string, stocked: number) => {
  const { products } = await call(
    request,
    admin,
    `/admin/products?handle=${handle}&fields=variants.inventory_items.inventory_item_id`
  )
  const inventoryItemId: string = products[0].variants[0].inventory_items[0].inventory_item_id
  const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
  await call(request, admin, `/admin/inventory-items/${inventoryItemId}/location-levels/${stock_locations[0].id}`, {
    stocked_quantity: stocked,
  })
}

const flaggedLines = async (request: APIRequestContext, admin: Headers, orderId: string) => {
  const { order } = await call(request, admin, `/admin/orders/${orderId}?fields=*items`)
  return order.items.filter((i: Json) => i.metadata?.evoucher_backordered === true).length
}

const importCode = async (request: APIRequestContext, admin: Headers, poolId: string) => {
  const res = await request.post(`${BACKEND_URL}/admin/evoucher/pools/${poolId}/import`, {
    headers: admin,
    multipart: {
      file: { name: "codes.csv", mimeType: "text/csv", buffer: Buffer.from(`ev24-${Date.now()},1234\n`) },
    },
  })
  expect(res.status(), "import codes").toBe(200)
}

test("AC-54: order backordered → dblclick Retry allocation ส่ง POST 1 ครั้ง; หลัง import code กด → toast และ badge หาย", async ({
  page,
  request,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const voucher = await createVoucher(request, admin, 0)
  await setStock(request, admin, voucher.handle, 1)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, voucher.variantId, 1)
  // EV-4 ทำงานแบบ async (subscriber payment.captured) — pool ว่างจึงถูก mark backordered
  await expect.poll(() => flaggedLines(request, admin, orderId), { timeout: 30_000 }).toBe(1)

  const allocatePath = `/admin/evoucher/orders/${orderId}/allocate`
  const posts: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === allocatePath) posts.push(req.url())
  })
  const widget = page.getByTestId("evoucher-order-widget")
  const retry = page.getByTestId("evoucher-retry-allocation")

  await step("เปิดหน้า order backordered → เห็นปุ่ม Retry allocation", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    await expect(widget.getByTestId("evoucher-backordered-badge")).toHaveCount(1, { timeout: 30_000 })
    await expect(retry).toBeVisible()
  })

  await step("ยังไม่ import code: dblclick → POST 1 ครั้ง และ toast ยัง backordered, badge ยังอยู่", async () => {
    const done = page.waitForResponse((res) => new URL(res.url()).pathname === allocatePath)
    await retry.dblclick()
    expect((await done).status()).toBe(200)
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /still backordered/i })).toBeVisible()
    expect(posts).toHaveLength(1)
    await expect(widget.getByTestId("evoucher-backordered-badge")).toHaveCount(1)
  })

  await step("import code แล้วกด Retry allocation → toast Codes allocated, badge และปุ่มหาย, code ถูกส่ง", async () => {
    await importCode(request, admin, voucher.poolId)
    await retry.click()
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /^Codes allocated$/ })).toBeVisible()
    await expect(widget.getByTestId("evoucher-backordered-badge")).toHaveCount(0, { timeout: 15_000 })
    await expect(retry).toHaveCount(0)
    await expect(widget.locator("tbody tr")).toHaveCount(1)
    expect(posts).toHaveLength(2)
    await widget.scrollIntoViewIfNeeded()
    await evidence("01-allocated")
  })
  await waitDelivered(request, admin, orderId, 1)
})

test("AC-54: order ที่ไม่มี line ค้าง → ไม่เห็นปุ่ม Retry allocation", async ({ page, request, step }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId } = await createVoucher(request, admin, 1)
  const orderId = await placeCapturedOrder(request, admin, pk, customer, variantId, 1)
  await waitDelivered(request, admin, orderId, 1)

  await step("เปิดหน้า order ที่ส่ง code ครบ → widget แสดง code แต่ไม่มีปุ่ม Retry allocation", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${orderId}`)
    const widget = page.getByTestId("evoucher-order-widget")
    await expect(widget.locator("tbody tr")).toHaveCount(1, { timeout: 30_000 })
    await expect(page.getByTestId("evoucher-retry-allocation")).toHaveCount(0)
  })
})
