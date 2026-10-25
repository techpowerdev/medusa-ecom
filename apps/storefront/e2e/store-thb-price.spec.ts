import { expect, test } from "./support/fixtures"

// CORE-9 (spec 01 กฎข้อ 15, AC-28): หน้า store อ่านราคาจาก search index ที่เก็บ THB → การ์ดทุกใบแสดงราคา ฿
// ต้องมี backend ที่ seed แล้ว (CORE-2) และ index ของ product สร้างเสร็จ
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-9" } })

const THB_PRICE = /^฿[\d,]+(\.\d{2})?$/

test("AC-28: การ์ดสินค้าทุกใบบน /th/store แสดงราคาเป็น ฿", async ({
  page,
  step,
  evidence,
}) => {
  const cards = page.getByTestId("products-list").getByTestId("product-wrapper")

  await step("เปิด /th/store และรอรายการสินค้าจาก search", async () => {
    await page.goto("/th/store")
    await expect(cards.first()).toBeVisible()
  })

  await step("การ์ดทุกใบมีราคาที่ตรงรูปแบบ ฿", async () => {
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    // การ์ดที่ไม่มีราคาใน index (เช่นสกุลเงินไม่ตรง) จะไม่ render data-testid="price" เลย
    await expect(cards.getByTestId("price")).toHaveCount(count)

    for (const text of await cards.getByTestId("price").allInnerTexts()) {
      expect(text.trim()).toMatch(THB_PRICE)
    }
    await evidence("01-store-thb-prices")
  })
})
