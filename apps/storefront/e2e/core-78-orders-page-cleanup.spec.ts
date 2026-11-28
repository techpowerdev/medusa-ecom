import { deleteAllThenExpectOk } from "./support/cleanup"
import { expect, test } from "./support/fixtures"
import { groupBuyOrder, leaveGroup } from "./support/group-buy"
import { STOREFRONT_COUNTRY as CC, placeOrder, signInAs } from "./support/medusa"
import { THAI, expectThai } from "./support/thai-text"

// CORE-78: spec 01 AC-177 (กฎข้อ 136) — ส่วนคำสั่งซื้อแบบกลุ่มแสดงเฉพาะหน้า 1 ของ /account/orders,
// overview แสดง "ดูทั้งหมด" เมื่อมีแต่ membership แบบกลุ่ม, `Pagination` มี aria-label/aria-current ภาษาไทย
// ปุ่มเลขหน้าของ Pagination (ไม่มี testid ต่อปุ่ม) หาด้วย role + ชื่อภายใน `orders-pagination`
// SFUI-19c (spec 09 กฎ 66, 78 (iv)): เลขหน้าเป็นลิงก์ `PaginationLink` ของ shadcn → หาด้วย role link
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-78" }, viewport: { width: 1280, height: 800 } })

const ordersPath = `/${CC}/account/orders`

test("AC-177: 12 order + membership กลุ่ม → ส่วนกลุ่มเฉพาะหน้า 1, Pagination มี aria-current และ aria-label ไทย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(300_000)
  const ctx = await groupBuyOrder(request, false)
  await signInAs(context, baseURL!, ctx.customer)
  const orders: { id: string }[] = []
  try {
    await step("Given ลูกค้ามี order ปกติ 12 ใบ + membership กลุ่ม 1", async () => {
      for (let i = 0; i < 12; i++) orders.push(await placeOrder(request, ctx.pk, ctx.customer))
    })
    const cards = page.getByTestId("order-card")
    const group = page.getByTestId("group-orders")
    const pagination = page.getByTestId("orders-pagination")

    await step("หน้า 1: เห็นส่วนกลุ่ม + order 10 ใบ + Pagination a11y ไทย", async () => {
      await page.goto(ordersPath)
      await expect(group).toBeVisible()
      await expect(cards).toHaveCount(10)
      await expect(pagination).toHaveAttribute("aria-label", "แบ่งหน้า")
      const buttons = pagination.getByRole("link")
      await expect(buttons).toHaveCount(2)
      for (const label of await buttons.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))) {
        expect(label, label).toMatch(THAI)
      }
      await expect(pagination.locator('[aria-current="page"]')).toHaveCount(1)
      await expect(pagination.getByRole("link", { name: "หน้า 1", exact: true })).toHaveAttribute("aria-current", "page")
      await expect(pagination.getByRole("link", { name: "หน้า 2", exact: true })).not.toHaveAttribute("aria-current", /.*/)
      await pagination.scrollIntoViewIfNeeded()
      await evidence("page-1-group-1280")
    })

    await step("กดหน้า 2 → ไม่เห็นส่วนกลุ่ม, aria-current ย้ายไปหน้า 2", async () => {
      await pagination.getByRole("link", { name: "หน้า 2", exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${ordersPath}\\?page=2$`))
      await expect(cards).toHaveCount(2)
      await expect(group).toHaveCount(0)
      await expect(pagination.getByRole("link", { name: "หน้า 2", exact: true })).toHaveAttribute("aria-current", "page")
      await evidence("page-2-no-group-1280")
    })

    await step("เปิด ?page=2 ตรง → ไม่เห็นส่วนกลุ่ม", async () => {
      await page.goto(`${ordersPath}?page=2`)
      await expect(cards).toHaveCount(2)
      await expect(group).toHaveCount(0)
    })
  } finally {
    await leaveGroup(request, ctx)
    await deleteAllThenExpectOk(
      request,
      ctx.admin,
      orders.map((o) => `POST /admin/orders/${o.id}/cancel`)
    )
  }
})

test("AC-177: ลูกค้าที่มีแต่ membership กลุ่ม → overview เห็นลิงก์ ดูทั้งหมด", async ({ page, context, request, baseURL }) => {
  test.setTimeout(120_000)
  const ctx = await groupBuyOrder(request, false)
  try {
    await signInAs(context, baseURL!, ctx.customer)
    await page.goto(`/${CC}/account`)
    const viewAll = page.getByTestId("overview-orders-view-all")
    await expect(viewAll).toBeVisible()
    await expectThai(page, ["overview-orders-view-all"])
    await viewAll.click()
    await expect(page).toHaveURL(new RegExp(`${ordersPath}$`))
    await expect(page.getByTestId("group-orders")).toBeVisible()
  } finally {
    await leaveGroup(request, ctx)
  }
})
