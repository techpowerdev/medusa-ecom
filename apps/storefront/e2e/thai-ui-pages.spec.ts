import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, adminHeaders } from "./support/medusa"
import { expectThai } from "./support/thai-text"

// CORE-4b2: spec 01 CORE-4 (ADR-014) AC-48 ส่วน store, /search, category, collection, PDP
// หา element ด้วย data-testid เท่านั้น ตรวจ "เป็นภาษาไทย" ด้วยอักษรไทย (ไม่ hard-code ประโยค)
// เลือกเฉพาะ element ที่เป็นข้อความของ storefront (ชื่อสินค้า/หมวดหมู่จาก backend ไม่นับ)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-4b" } })

const PRODUCT = "t-shirt" // seed (CORE-2)
const CATEGORY = "shirts" // seed: หมวด "Shirts"

test("AC-48: หน้า store และ PDP เป็นภาษาไทย", async ({ page, step, evidence }) => {
  await step("store: หัวข้อ, ตัวเลือกเรียงลำดับ, ช่องค้นหา", async () => {
    await page.goto(`/${CC}/store`)
    await expect(page.getByTestId("products-list")).toBeVisible()
    await expectThai(page, ["store-page-title", "sort-by-container", "refinement-title-category"])
    await expect(page.getByTestId("store-search-input")).toHaveAttribute(
      "placeholder",
      /[฀-๿]/
    )
    expect(await page.title()).toMatch(/[฀-๿]/)
    await evidence("4b2-01-store-th")
  })

  await step("PDP: ปุ่มเพิ่มลงตะกร้าและแท็บข้อมูลสินค้า", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await expectThai(page, [
      "add-product-button",
      "product-tab-information",
      "product-tab-shipping",
    ])
    await evidence("4b2-02-pdp-th")
  })
})

test("AC-48: หน้า /search เป็นภาษาไทย", async ({ page, step }) => {
  await step("ค้นหาด้วยคำที่มีผล", async () => {
    await page.goto(`/${CC}/search?q=shirt`)
    await expectThai(page, ["search-result-count", "search-submit"])
    await expect(page.getByTestId("search-query-input")).toHaveAttribute(
      "placeholder",
      /[฀-๿]/
    )
  })

  await step("ค้นหาด้วยคำที่ไม่มีผล", async () => {
    await page.goto(`/${CC}/search?q=zzzz-no-such-product-core4b`)
    await expectThai(page, ["search-no-results"])
  })
})

test("AC-48: หน้า category และ collection เป็นภาษาไทย", async ({ page, request, step }) => {
  await step("category ของ seed", async () => {
    await page.goto(`/${CC}/categories/${CATEGORY}`)
    await expect(page.getByTestId("category-page-title")).toBeVisible()
    await expectThai(page, ["sort-by-container", "nav-account-link"])
    // title = ชื่อหมวดจาก backend + ชื่อร้าน; description ที่ storefront สร้างเองต้องเป็นไทย (seed ไม่มี description)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /[฀-๿]/
    )
  })

  await step("collection ที่สร้างผ่าน admin API", async () => {
    const admin = await adminHeaders(request)
    const handle = `core4b-${Date.now()}`
    const res = await request.post(`${BACKEND_URL}/admin/collections`, {
      headers: admin,
      data: { title: handle, handle },
    })
    expect(res.status(), "create collection").toBe(200)
    await page.goto(`/${CC}/collections/${handle}`)
    await expect(page.getByTestId("collection-page-title")).toBeVisible()
    await expectThai(page, ["sort-by-container", "nav-account-link"])
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /[฀-๿]/
    )
  })
})
