import type { Locator } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-6 (spec 09 กฎ 19): ค่าที่ render บน develop ต้องคงเดิมหลังลบ shim/legacy
// - <Container> ของ shim = clsx("bg-white rounded-lg p-4", className) — ใน CSS v3 `.bg-white`/`.p-4` อยู่หลัง `.bg-ui-bg-subtle`,
//   `.bg-gray-100`, `.p-2` จึงชนะ class ของผู้เรียก → พื้นขาว + padding 16px (thumbnail, image gallery ของ PDP)
// - Table.Cell/HeaderCell ของ shim ไม่มี whitespace-nowrap (TableCell/TableHead ของ shadcn มี) และหัวตารางสูง h-12 (48px)
// - <Heading> h2 + utility ฟอนต์ base/semi ของ starter (ลบใน SFUI-10) ของการ์ดที่อยู่: utility นั้นอยู่ @layer components ของ v3 จึงแพ้ text-2xl/font-semibold ของ shim → 24px/32px/600
// - ข้อมูลจาก seed (CORE-2)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-6" } })

const WHITE = /^(rgb\(255, 255, 255\)|oklch\(1 0 0\)|lab\(100 0 0\))$/
const style = (el: Locator) =>
  el.evaluate((node) => {
    const s = getComputedStyle(node)
    return { background: s.backgroundColor, padding: s.padding, whiteSpace: s.whiteSpace, height: s.height }
  })

test("AC-16 (กฎ 19): thumbnail และ image gallery พื้นขาว padding 16px เท่า develop", async ({ page, step, evidence }) => {
  await step("store: กรอบ thumbnail ของการ์ดสินค้า", async () => {
    await page.goto(`/${CC}/store`)
    const card = page.getByTestId("products-list").getByTestId("product-wrapper").first()
    await expect(card).toBeVisible()
    const thumb = await style(card.locator("div").first())
    expect.soft(thumb.background).toMatch(WHITE)
    expect.soft(thumb.padding).toBe("16px")
    await evidence("01-store-thumbnail")
  })

  await step("PDP: กรอบรูปของ image gallery", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    const frame = page.getByTestId("product-container").locator('div[id^="img_"]').first()
    await expect(frame).toBeVisible()
    const s = await style(frame)
    expect.soft(s.background).toMatch(WHITE)
    expect.soft(s.padding).toBe("16px")
  })
})

test("AC-16 (กฎ 19): ตารางตะกร้า — เซลล์ตัดบรรทัดได้ (white-space normal) และหัวตารางสูง 48px เท่า develop", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("ใส่สินค้าลงตะกร้าแล้วเปิด /cart", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/cart`)
  })

  await step("หัวตาราง: สูง 48px และ white-space normal", async () => {
    const heads = page.getByTestId("cart-items-header").locator("th")
    await expect(heads.first()).toBeVisible()
    // SFUI-24c (spec 01 กฎข้อ 159a): ไม่มีคอลัมน์ "รวม" — หัวตาราง 4 ช่อง (ช่องสุดท้าย = ราคา)
    for (const i of [0, 2, 3]) {
      const s = await style(heads.nth(i))
      expect.soft(s.height, `th ${i}`).toBe("48px")
      expect.soft(s.whiteSpace, `th ${i}`).toBe("normal")
    }
  })

  await step("แถวสินค้า: ทุก cell white-space normal", async () => {
    const cells = page.getByTestId("product-row").first().locator("td")
    await expect(cells.first()).toBeVisible()
    const count = await cells.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      expect.soft((await style(cells.nth(i))).whiteSpace, `td ${i}`).toBe("normal")
    }
    await evidence("02-cart-table")
  })
})

test("AC-16 (กฎ 21): ชื่อบนการ์ดที่อยู่ (address-name) 24px/32px/600 เท่า develop", async ({ page, context, request, baseURL }) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const saved = await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    data: {
      first_name: "สมชาย",
      last_name: "ใจดี",
      address_1: "1 ถนนพระราม 4",
      postal_code: "10500",
      city: "บางรัก",
      province: "กรุงเทพมหานคร",
      country_code: CC,
      phone: "0800000000",
    },
  })
  expect(saved.status(), "saved address").toBe(200)
  await signInAs(context, baseURL!, customer)

  await page.goto(`/${CC}/account/addresses`)
  const name = page.getByTestId("address-name").first()
  await expect(name).toBeVisible()
  const font = await name.evaluate((el) => {
    const s = getComputedStyle(el)
    return { tag: el.tagName, size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })
  expect(font).toEqual({ tag: "H2", size: "24px", lineHeight: "32px", weight: "600" })
})
