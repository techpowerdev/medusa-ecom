import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"

// SFUI-2 (spec 09 กฎ 7, AC-4 ข้อ 2): ปุ่มหลักที่ส่งต่อจาก shim ไป Button ของ shadcn ใช้สี `--primary`
// = brand-900 `#171717` (ADR-030 ข้อ 7) — ข้อมูลตั้งต้นจาก seed (CORE-2): t-shirt
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-2" } })

test("AC-4 (2): ปุ่ม add-product-button บน PDP มีสีพื้น brand-900 ผ่าน --primary", async ({
  page,
  step,
  evidence,
}) => {
  await step("เปิด PDP ของ t-shirt", async () => {
    await page.goto(`/${CC}/products/t-shirt`)
    await expect(page.getByTestId("add-product-button")).toBeVisible()
  })

  await step("อ่าน computed background-color ของ add-product-button", async () => {
    const button = page.getByTestId("add-product-button")
    await expect(button).toHaveAttribute("data-slot", "button")
    await expect(button).toHaveCSS("background-color", "rgb(23, 23, 23)")
    await evidence("01-pdp-add-button-brand-900")
  })
})
