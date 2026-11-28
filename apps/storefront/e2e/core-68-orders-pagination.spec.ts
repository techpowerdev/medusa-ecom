import { deleteAllThenExpectOk } from "./support/cleanup"
import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// CORE-68: spec 01 AC-167 (กฎข้อ 126) — /account/orders หน้าละ 10 จาก count ของ Medusa, `orders-pagination`, ?page= 1-based,
// หน้าเกินจำนวน → หน้าสุดท้าย; overview คง 5 ล่าสุด + ลิงก์ "ดูทั้งหมด" (เดิมแสดงแค่ 10 ใบล่าสุด ไม่มีหน้า 2)
// หาด้วย data-testid; ปุ่มเลขหน้าของ Pagination (component ของ starter ไม่มี testid ต่อปุ่ม) หาด้วย role + ชื่อภายใน `orders-pagination`
// SFUI-19c (spec 09 กฎ 66, 78 (iv)): เลขหน้าเป็นลิงก์ `PaginationLink` ของ shadcn → หาด้วย role link
// (ชื่อเป็น aria-label ไทย "หน้า N" ตั้งแต่ CORE-78 กฎข้อ 136c)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-68" }, viewport: { width: 1280, height: 800 } })

const ordersPath = `/${CC}/account/orders`

test("AC-167: ลูกค้า 12 order → หน้า 1 มี 10 แถว, หน้า 2 มี 2 แถว (เก่าสุดอยู่หน้า 2), หน้าเกิน → หน้าสุดท้าย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(300_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer: Customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  // display_id เรียงจากเก่าไปใหม่ (สร้างทีละใบ)
  const orders: { id: string; displayId: number }[] = []
  try {
    await step("Given ลูกค้ามี order 12 ใบ", async () => {
      for (let i = 0; i < 12; i++) orders.push(await placeOrder(request, pk, customer))
    })
    const displayIds = (ids: { displayId: number }[]) => ids.map((o) => String(o.displayId))
    const newestFirst = [...orders].reverse()
    const cards = page.getByTestId("order-card")
    const pagination = page.getByTestId("orders-pagination")

    await step("หน้า 1: 10 ใบล่าสุด + orders-pagination", async () => {
      await page.goto(ordersPath)
      await expect(cards).toHaveCount(10)
      await expect(cards.getByTestId("order-display-id")).toHaveText(displayIds(newestFirst.slice(0, 10)))
      await expect(pagination).toBeVisible()
      await expectThai(page, ["account-page-header"])
      await pagination.scrollIntoViewIfNeeded()
      await evidence("page-1-1280")
    })

    await step("กดหน้า 2 → ?page=2 มี 2 ใบ (order เก่าสุดอยู่หน้า 2)", async () => {
      await pagination.getByRole("link", { name: "หน้า 2", exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${ordersPath}\\?page=2$`))
      await expect(cards).toHaveCount(2)
      await expect(cards.getByTestId("order-display-id")).toHaveText(displayIds(newestFirst.slice(10)))
      await evidence("page-2-1280")
    })

    await step("?page=99 → หน้าสุดท้าย (2)", async () => {
      await page.goto(`${ordersPath}?page=99`)
      await expect(page).toHaveURL(new RegExp(`${ordersPath}\\?page=2$`))
      await expect(cards).toHaveCount(2)
    })

    await step("?page=abc → หน้า 1", async () => {
      await page.goto(`${ordersPath}?page=abc`)
      await expect(cards).toHaveCount(10)
    })

    await step("overview ของ account: 5 ล่าสุด + ลิงก์ดูทั้งหมด → /account/orders", async () => {
      await page.goto(`/${CC}/account`)
      const rows = page.getByTestId("orders-wrapper").getByTestId("order-wrapper")
      await expect(rows).toHaveCount(5)
      await expect(rows.getByTestId("order-id")).toHaveText(displayIds(newestFirst.slice(0, 5)).map((d) => `#${d}`))
      const viewAll = page.getByTestId("overview-orders-view-all")
      await expectThai(page, ["overview-orders-view-all"])
      await viewAll.click()
      await expect(page).toHaveURL(new RegExp(`${ordersPath}$`))
      await expect(cards).toHaveCount(10)
    })
  } finally {
    await deleteAllThenExpectOk(
      request,
      admin,
      orders.map((o) => `POST /admin/orders/${o.id}/cancel`)
    )
  }
})

test("AC-167: order ≤ 10 ใบ → ไม่แสดง orders-pagination", async ({ page, context, request, baseURL }) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer: Customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const orders: { id: string }[] = []
  try {
    orders.push(await placeOrder(request, pk, customer))
    await page.goto(ordersPath)
    await expect(page.getByTestId("order-card")).toHaveCount(1)
    await expect(page.getByTestId("orders-pagination")).toHaveCount(0)
  } finally {
    await deleteAllThenExpectOk(
      request,
      admin,
      orders.map((o) => `POST /admin/orders/${o.id}/cancel`)
    )
  }
})
