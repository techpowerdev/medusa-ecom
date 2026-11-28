import type { Locator } from "@playwright/test"

import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-5d (spec 09 กฎ 19–21, AC-15): หน้า account + order หลังย้ายจาก class ของ preset/shim ไป utility + token ของ shadcn
// ค่าที่คาด = ค่าที่ render จริงบน develop (Tailwind v3 + @medusajs/ui-preset) — ไม่ใช่ค่าของชื่อ class
// - txt-medium(-plus) → 14px / line-height 22.4px (กฎ 21); -plus → 500
// - Heading ของ shim + `text-*-regular/semi` ของ globals.css: บน develop class เหล่านี้อยู่ใน @layer components จึงแพ้
//   `text-2xl font-semibold` ของ Heading (utilities) → หัวข้อ h2 = 24px / 32px / 600
// - TableCell ของ order คง p-4 (16px) ตามกฎ 21 (shadcn ตรงใช้ p-2)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-5d" } })

type Box = { fontSize: string; lineHeight: string; fontWeight: string }

const typo = (el: Locator): Promise<Box> =>
  el.evaluate((node) => {
    const s = getComputedStyle(node)
    return { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight }
  })

const padding = (el: Locator) =>
  el.evaluate((node) => {
    const s = getComputedStyle(node)
    return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(" ")
  })

const H2 = { fontSize: "24px", lineHeight: "32px", fontWeight: "600" }
const TXT_MEDIUM = { fontSize: "14px", lineHeight: "22.4px", fontWeight: "400" }
const TXT_MEDIUM_PLUS = { ...TXT_MEDIUM, fontWeight: "500" }

// Container ของ shim บน develop = clsx("bg-white rounded-lg p-4", className) และใน CSS v3 `.bg-white`/`.p-4` อยู่หลัง
// `.bg-gray-50`/`.bg-ui-button-neutral-hover`/`.p-2` → พื้นขาว + padding 16px ชนะ class ที่ผู้เรียกส่ง (review SFUI-5d)
const WHITE = /^(rgb\(255, 255, 255\)|oklch\(1 0 0\)|lab\(100 0 0\))$/
const background = (el: Locator) => el.evaluate((node) => getComputedStyle(node).backgroundColor)
const whiteSpace = (el: Locator) => el.evaluate((node) => getComputedStyle(node).whiteSpace)

test("order: ตาราง/ตัวอักษร/หัวข้อ/ไอคอน คงค่าเดิมทั้งหน้า confirmed และรายละเอียด order ใน account", async ({
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
  await signInAs(context, baseURL!, customer)
  const { id } = await placeOrder(request, pk, customer)

  await step("หน้า order confirmed: หัวข้อ, ตาราง, รายละเอียดการชำระเงิน/จัดส่ง", async () => {
    await page.goto(`/${CC}/order/${id}/confirmed`)
    const container = page.getByTestId("order-complete-container")
    await expect(container).toBeVisible()

    expect.soft(await typo(page.getByTestId("order-complete-summary-heading"))).toEqual(H2)
    expect.soft(await typo(page.getByTestId("shipping-details-heading"))).toEqual(H2)
    expect.soft(await typo(page.getByTestId("payment-details-heading"))).toEqual(H2)
    expect.soft(await typo(page.getByTestId("order-help").locator("h2"))).toEqual(H2)

    const row = container.getByTestId("product-row")
    const cells = row.locator("td")
    await expect(cells).toHaveCount(3)
    expect.soft(await padding(cells.nth(0))).toBe("16px 16px 16px 0px")
    expect.soft(await padding(cells.nth(1))).toBe("16px 16px 16px 16px")
    expect.soft(await padding(cells.nth(2))).toBe("16px 0px 16px 16px")
    // Table.Cell เดิมไม่มี whitespace-nowrap → ชื่อสินค้ายาว/ตัวเลือกตัดบรรทัดได้ (TableCell ของ shadcn มี nowrap)
    for (const i of [0, 1, 2]) expect.soft(await whiteSpace(cells.nth(i)), `cell ${i}`).toBe("normal")
    expect.soft(await typo(row.getByTestId("product-name"))).toEqual(TXT_MEDIUM_PLUS)
    // SFUI-24c (spec 01 กฎข้อ 159a): "฿ราคาต่อชิ้น × จำนวน" อยู่ในบรรทัดเดียวกับราคา (text-sm leading-6 ของราคาเดิม) = 14px/24px/400
    expect.soft(await typo(row.getByTestId("product-quantity").locator(".."))).toEqual({ ...TXT_MEDIUM, lineHeight: "24px" })

    // OrderDetails: <Text> ที่ไม่ใส่ขนาด = txt-medium
    expect.soft(await typo(page.getByTestId("order-email").locator(".."))).toEqual(TXT_MEDIUM)
    expect.soft(await typo(page.getByTestId("order-id").locator(".."))).toEqual(TXT_MEDIUM)

    // ShippingDetails/PaymentDetails: หัวคอลัมน์ txt-medium-plus, ค่า txt-medium
    const address = page.getByTestId("shipping-address-summary")
    expect.soft(await typo(address.locator("p").first())).toEqual(TXT_MEDIUM_PLUS)
    expect.soft(await typo(address.locator("p").nth(1))).toEqual(TXT_MEDIUM)
    expect.soft(await typo(page.getByTestId("payment-method"))).toEqual(TXT_MEDIUM)
    expect.soft(await typo(page.getByTestId("payment-amount"))).toEqual(TXT_MEDIUM)
    // กล่อง icon ของวิธีชำระเงิน (Container ของ shim): พื้นขาว + p-4 ตามค่าที่ชนะบน develop
    const iconBox = page.getByTestId("payment-amount").locator("xpath=preceding-sibling::div[1]")
    expect.soft(await background(iconBox)).toMatch(WHITE)
    expect.soft(await padding(iconBox)).toBe("16px 16px 16px 16px")
    await evidence("01-order-confirmed")
  })

  await step("หน้ารายละเอียด order ใน account: ไอคอนปิด 15px, สถานะ, ตาราง", async () => {
    await page.goto(`/${CC}/account/orders/details/${id}`)
    const container = page.getByTestId("order-details-container")
    await expect(container).toBeVisible()

    const icon = page.getByTestId("back-to-overview-button").locator("svg")
    await expect(icon).toBeVisible()
    const size = await icon.boundingBox()
    expect.soft([size?.width, size?.height]).toEqual([15, 15])

    expect.soft(await typo(page.getByTestId("order-status").locator(".."))).toEqual(TXT_MEDIUM)
    const cells = container.getByTestId("product-row").locator("td")
    expect.soft(await padding(cells.nth(1))).toBe("16px 16px 16px 16px")
    expect.soft(await typo(page.getByTestId("shipping-details-heading"))).toEqual(H2)
    await evidence("02-account-order-details")
  })

  await step("หน้าภาพรวม + รายการ order ใน account: การ์ด order พื้นขาว p-4, ลิงก์ดูรายละเอียดเป็นปุ่มขอบ (outline), ข้อความช่วยเหลือ txt-medium", async () => {
    await page.goto(`/${CC}/account`)
    // การ์ด order ล่าสุดในหน้าภาพรวม (Container ของ shim): พื้นขาว + p-4 ตามค่าที่ชนะบน develop
    const card = page.getByTestId("order-wrapper").first().locator("a > div")
    await expect(card).toBeVisible()
    expect.soft(await background(card)).toMatch(WHITE)
    expect.soft(await padding(card)).toBe("16px 16px 16px 16px")

    await page.goto(`/${CC}/account/orders`)
    const link = page.getByTestId("order-details-link").first()
    await expect(link).toBeVisible()
    expect.soft(await link.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("1px")
    expect.soft(await typo(page.getByTestId("account-help").locator("span"))).toEqual(TXT_MEDIUM)
  })
})
