import { expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-3e (spec 09 กฎ 4, 9, 19–20, AC-13): ขั้น delivery — ตัวเลือกจัดส่งเป็นปุ่ม role="radio" ของ RadioGroup (shadcn)
// และหัวขั้น "การจัดส่ง"/"การชำระเงิน" คงขนาดเดิมของ develop (`Heading` h2 = text-2xl font-semibold → 24px/32px, 600)
// — review 5c: utility ฟอนต์ 3xl/regular ของ starter (ลบใน SFUI-10) อยู่ใน @layer components จึงแพ้ text-2xl บน develop; ห้ามกลายเป็น 32px/44px
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-3e" } })

test("AC-13: ขั้น delivery — ตัวเลือกเป็น role=radio ที่ยังไม่ติ๊ก และหัวขั้นจัดส่ง/ชำระเงินขนาด 24px/32px semibold", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
  await page.goto(`/${CC}/checkout?step=delivery`)

  await step("ตัวเลือกจัดส่งเป็นปุ่ม role=radio ใน radiogroup และไม่มีตัวที่ติ๊ก", async () => {
    const radio = page.getByTestId("delivery-option-radio").first()
    await expect(radio).toBeVisible()
    await expect(radio).toHaveAttribute("role", "radio")
    await expect(page.getByTestId("delivery-options-container").getByRole("radiogroup")).toHaveCount(1)
  })

  await step("หัวขั้น delivery-heading และ payment-heading = 24px / line-height 32px / font-weight 600", async () => {
    for (const id of ["delivery-heading", "payment-heading"]) {
      const heading = page.getByTestId(id)
      await expect(heading).toHaveCSS("font-size", "24px")
      await expect(heading).toHaveCSS("line-height", "32px")
      await expect(heading).toHaveCSS("font-weight", "600")
    }
    await evidence("01-delivery-step")
  })
})
