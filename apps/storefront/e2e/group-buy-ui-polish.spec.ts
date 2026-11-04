import { Locator } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, groupBuyOrder, poolGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// GB-12 (spec 04 กฎข้อ 32b, 32d, 32e; AC-51 ส่วน e2e): ชื่อ/ราคาต่อชิ้นใน group-selection, กล่องยืนยันออกจากกลุ่มที่ 375px
// และ empty state เดียวในหน้า orders (countdown กลาง + "ต่อชิ้น" ตรวจด้วย unit)
test.use({ evidenceTarget: { feature: "group-buying", taskId: "GB-12" } })

const ADDRESS = {
  first_name: "สมชาย",
  last_name: "ใจดี",
  address_1: "1 ถนนสุขุมวิท",
  city: "กรุงเทพ",
  postal_code: "10110",
  phone: "0811111111",
}
const ordersPath = `/${CC}/account/orders`

async function box(locator: Locator) {
  const b = await locator.boundingBox()
  expect(b, "element ต้องมองเห็นได้").not.toBeNull()
  return b!
}

test.describe("GB-12: UI ของ group buy (AC-51)", () => {
  test("group-selection แสดงชื่อสินค้า + variant และราคาต่อชิ้นตาม GET /store/products", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    const ctx = await poolGroup(request)
    const customer = await createCustomer(request, ctx.pk)
    await addAddresses(request, ctx.pk, customer, [ADDRESS])
    await signInAs(context, baseURL!, customer)

    const res = await request.get(
      `${BACKEND_URL}/store/products?handle=t-shirt&region_id=${ctx.regionId}&fields=*variants.calculated_price`,
      { headers: { "x-publishable-api-key": ctx.pk } }
    )
    expect(res.status(), await res.text()).toBe(200)
    const product = (await res.json()).products[0]
    const v1 = product.variants.find(
      (v: { id: string }) => v.id === ctx.variants.S
    )

    await page.goto(`/${CC}/g/${ctx.token}`)
    await page
      .getByTestId("group-options")
      .getByTestId("option-button")
      .filter({ hasText: /^S$/ })
      .click()
    await page.getByTestId("group-quantity").selectOption("2")
    await page.getByTestId("group-add-variant").click()

    const row = page.getByTestId("group-selection-item")
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId("group-selection-quantity")).toHaveValue("2")
    await expect(row.getByTestId("group-selection-title")).toContainText(
      product.title
    )
    await expect(row.getByTestId("group-selection-title")).toContainText(
      v1.title
    )
    await expect(row.getByTestId("group-selection-price")).toHaveAttribute(
      "data-value",
      String(v1.calculated_price.calculated_amount)
    )
    await expectThai(page, ["group-selection-price"])
    await evidence("01-selection-title-price")
  })

  test("375px: กล่องยืนยันออกจากกลุ่มสองแถว ปุ่มไม่ตัดคำ ไม่ล้นจอ; 1280px แถวเดียว; ไม่มี no-orders-container", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const ctx = await groupBuyOrder(request, false)
    await signInAs(context, baseURL!, ctx.customer)
    await page.goto(ordersPath)
    await expect(page.getByTestId("group-orders")).toBeVisible()
    await expect(page.getByTestId("no-orders-container")).toHaveCount(0)

    const row = page.locator(
      `[data-testid="group-order-card"][data-order-id="${ctx.orderId}"]`
    )
    await row.getByTestId("group-leave-button").click()
    const confirmBox = row.getByTestId("group-leave-confirm-box")
    const message = confirmBox.locator(":scope > span")
    const confirm = row.getByTestId("group-leave-confirm")
    const cancel = row.getByTestId("group-leave-cancel")

    const [m, c, n] = [
      await box(message),
      await box(confirm),
      await box(cancel),
    ]
    expect(m.y + m.height).toBeLessThanOrEqual(c.y)
    expect(Math.abs(c.height - n.height)).toBeLessThanOrEqual(2)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(375)
    await expectThai(page, ["group-leave-confirm-box"])
    await evidence("02-leave-confirm-375")

    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(confirmBox).toBeVisible()
    const [m2, c2] = [await box(message), await box(confirm)]
    expect(
      Math.abs(m2.y + m2.height / 2 - (c2.y + c2.height / 2))
    ).toBeLessThan(5)
    await expect(page.getByTestId("no-orders-container")).toHaveCount(0)
  })

  test("ลูกค้าที่ไม่มีทั้ง order ปกติและคำสั่งซื้อแบบกลุ่ม → no-orders-container 1 อัน", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    await page.goto(ordersPath)
    await expect(page.getByTestId("no-orders-container")).toHaveCount(1)
    await expect(page.getByTestId("group-orders")).toHaveCount(0)
    await expectThai(page, ["no-orders-container"])
  })
})
