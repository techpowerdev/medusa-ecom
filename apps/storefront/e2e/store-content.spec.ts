import { expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC } from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-18: spec 01 กฎข้อ 33, AC-61 (+ AC-67 ส่วน PDP แสดงปกติ)
// ไม่มีข้อความ/ลิงก์โฆษณาของ starter ที่ผู้ใช้เห็น; hero และ footer เป็นเนื้อหาร้านภาษาไทย
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-18" } })

const PRODUCT = "t-shirt" // seed (CORE-2)
const STARTER_TEXT = /Medusa|Next\.js|GitHub/i
const STARTER_LINKS = 'a[href*="github.com"], a[href*="medusajs.com"], a[href*="nextjs.org"]'
// AC-61 (ฉบับปรับรอบ 6): ตรวจเฉพาะข้อความที่ storefront เขียนเอง — ข้อมูลสินค้าจาก backend
// (ชื่อ/คำอธิบายสินค้า, หมวดหมู่) แสดงตามที่ได้รับ (ADR-014 ข้อ 5) จึงตัดออกด้วย data-testid ก่อนตรวจ
const BACKEND_DATA_TEST_IDS = [
  "product-title",
  "mobile-title",
  "product-description",
  "category-link",
]

const storefrontText = (testIds: string[]) => {
  let text = document.body.innerText
  const selector = testIds.map((id) => `[data-testid="${id}"]`).join(", ")
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const data = el.innerText.trim()
    if (data) {
      text = text.replace(data, " ")
    }
  }
  return text
}

const PAGES = [
  { name: "home", path: `/${CC}`, ready: "hero-title" },
  { name: "store", path: `/${CC}/store`, ready: "products-list" },
  { name: "PDP", path: `/${CC}/products/${PRODUCT}`, ready: "add-product-button" },
  { name: "account (ไม่ล็อกอิน)", path: `/${CC}/account`, ready: "login-page" },
]

test("AC-61, AC-67: ไม่มีข้อความ/ลิงก์ของ starter; hero และ footer เป็นภาษาไทย", async ({
  page,
  step,
  evidence,
}) => {
  for (const { name, path, ready } of PAGES) {
    await step(`${name}: ไม่มีข้อความและลิงก์ของ starter`, async () => {
      await page.goto(path)
      await expect(page.getByTestId(ready).first()).toBeVisible()
      const text = await page.evaluate(storefrontText, BACKEND_DATA_TEST_IDS)
      expect(text).not.toMatch(STARTER_TEXT)
      await expect(page.locator(STARTER_LINKS)).toHaveCount(0)
    })
  }

  await step("home: hero และ footer มีอักษรไทย", async () => {
    await page.goto(`/${CC}`)
    for (const id of ["hero-title", "hero-subtitle", "hero-cta", "footer-store-name", "footer-tagline"]) {
      await expect(page.getByTestId(id), id).toBeVisible()
      expect((await page.getByTestId(id).textContent()) ?? "", id).toMatch(THAI)
    }
    await evidence("18-01-home-store-content")
    await page.getByTestId("footer-tagline").scrollIntoViewIfNeeded()
    await evidence("18-02-home-footer")
  })

  await step("hero CTA พาไปหน้ารวมสินค้า", async () => {
    await page.getByTestId("hero-cta").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/store`))
    await expect(page.getByTestId("products-list")).toBeVisible()
  })
})
