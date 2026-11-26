import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { addToCartFromPdp } from "./support/server-action"

// SFUI-5c (spec 09 กฎ 19–21, AC-15; review SFUI-5c blocker 1): หัวข้อ h2 ของ checkout ที่เดิมเป็น `<Heading>` ของ shim
// (`font-semibold text-2xl` เป็น utility ชนะ utility ฟอนต์ 3xl/regular ของ starter (ลบใน SFUI-10) ใน @layer components บน develop) ต้องคงขนาด 24px/32px semibold
const HEADINGS = ["addresses-heading", "review-heading", "checkout-summary-heading"]

test("AC-15: หัวข้อขั้น checkout คงขนาด 24px/32px semibold เท่า develop", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("ใส่สินค้าลงตะกร้าแล้วเปิด checkout ขั้นที่อยู่", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await addToCartFromPdp(page, { request, pk, customer })
    await page.goto(`/${CC}/checkout?step=address`)
  })

  for (const testId of HEADINGS) {
    await step(`${testId}: font-size/line-height/weight`, async () => {
      const heading = page.getByTestId(testId)
      await expect(heading).toBeVisible()
      const style = await heading.evaluate((el) => {
        const s = getComputedStyle(el)
        return { tag: el.tagName, fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight }
      })
      expect(style).toEqual({ tag: "H2", fontSize: "24px", lineHeight: "32px", fontWeight: "600" })
    })
  }
})

// review SFUI-5c: h1 ของตะกร้าว่าง — develop = 32px/44px semibold (shim ใส่ font-semibold, utility ฟอนต์ 3xl/regular ของ starter อยู่ @layer components)
// ไม่พึ่ง utility ฟอนต์ 3xl/regular ของ starter (v4 เป็น @utility ที่ตั้ง font-normal ด้วย น้ำหนักจึงขึ้นกับลำดับ CSS)
test("AC-15: หัวข้อตะกร้าว่างคงขนาด 32px/44px semibold เท่า develop", async ({ page, context, request, baseURL }) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await page.goto(`/${CC}/cart`)
  const heading = page.getByTestId("empty-cart-message").locator("h1")
  await expect(heading).toBeVisible()
  const style = await heading.evaluate((el) => {
    const s = getComputedStyle(el)
    return { fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight }
  })
  expect(style).toEqual({ fontSize: "32px", lineHeight: "44px", fontWeight: "600" })
})
