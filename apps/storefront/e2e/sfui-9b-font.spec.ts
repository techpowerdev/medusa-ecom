import type { Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { createFlashCampaign, createFlashProduct, endFlashCampaign } from "./support/flash-sale"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// SFUI-9b (spec 09 กฎ 22, AC-21): หน้า catalog เลิกใช้ utility ฟอนต์ของ starter (`text-*-regular/semi`) → utility มาตรฐาน
// ค่าที่ render (font-size/line-height/font-weight) ต้องเท่าที่วัดที่ปลาย develop ก่อนแก้ — spec นี้ผ่านทั้งบน commit ฐานและหลังแก้
// จุดตัวอย่าง: ทุก token ที่ต่างกันในขอบเขต (small-regular, base-regular, base-semi, large-regular, xl-semi, 2xl-regular, 2xl-semi)
// ไม่มีจุดที่เข้ากฎ 22b/22c ในขอบเขตนี้; ไม่ใช้ `option-button`/label ของ `product-quantity-select` (rule floating label จับ — AC-23 ของ SFUI-8)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-9b" } })
test.describe.configure({ mode: "serial" })

const font = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })

const SMALL = { size: "12px", lineHeight: "20px", weight: "400" } // เดิม text-small-regular
const BASE = { size: "14px", lineHeight: "24px", weight: "400" } // เดิม text-base-regular
const BASE_SEMI = { size: "14px", lineHeight: "24px", weight: "600" } // เดิม text-base-semi
const LARGE = { size: "16px", lineHeight: "24px", weight: "400" } // เดิม text-large-regular
const XL_SEMI = { size: "24px", lineHeight: "36px", weight: "600" } // เดิม text-xl-semi
const XXL = { size: "30px", lineHeight: "48px", weight: "400" } // เดิม text-2xl-regular
const XXL_SEMI = { size: "30px", lineHeight: "48px", weight: "600" } // เดิม text-2xl-semi

const PRODUCT = "t-shirt"

let admin: Headers
let pk: string

async function signIn(page: Page, baseURL: string) {
  await signInAs(page.context(), baseURL, await createCustomer(page.request, pk))
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  pk = await publishableKey(request, admin)
})

test("AC-21: store, category, collection, PDP และหน้าค้นหาคงขนาด/ระยะบรรทัด/น้ำหนักเดิม", async ({
  page,
  baseURL,
  step,
  evidence,
}) => {
  await signIn(page, baseURL!)

  await step("store: หัวข้อ 30px/48px/600 และราคาต่ำ/สูงของตัวกรองราคา 12px/20px/400", async () => {
    await page.goto(`/${CC}/store`)
    expect(await font(page.getByTestId("store-page-title"))).toEqual(XXL_SEMI)
    expect(await font(page.getByTestId("price-range-min"))).toEqual(SMALL)
    expect(await font(page.getByTestId("price-range-max"))).toEqual(SMALL)
    await evidence("01-store")
  })

  await step("category และ collection: หัวข้อ 30px/48px/600", async () => {
    await page.goto(`/${CC}/categories/shirts`)
    expect(await font(page.getByTestId("category-page-title"))).toEqual(XXL_SEMI)
    await page.goto(`/${CC}/collections/featured`)
    expect(await font(page.getByTestId("collection-page-title"))).toEqual(XXL_SEMI)
  })

  await step("PDP: ราคา 24px/36px/600, สถานะสินค้า 12px/20px/400 และหัวข้อสินค้าที่เกี่ยวข้อง 14px/24px/400 + 30px/48px/400", async () => {
    const { variantId } = await variantOf(page.request, pk, PRODUCT)
    await page.goto(`/${CC}/products/${PRODUCT}?v_id=${variantId}`)
    await expect(page.getByTestId("product-availability")).toBeVisible()
    expect(await font(page.getByTestId("product-price").first())).toEqual(XL_SEMI)
    expect(await font(page.getByTestId("product-availability"))).toEqual(SMALL)
    // หัวข้อของ related products ไม่มี testid — หาลูกลำดับที่ 1/2 ของกล่องหัวข้อภายใน container ที่มี testid
    const heading = page.getByTestId("related-products-container").locator("xpath=.//div[span][p][1]")
    await expect(heading).toBeVisible()
    expect(await font(heading.locator("xpath=./span"))).toEqual(BASE)
    expect(await font(heading.locator("xpath=./p"))).toEqual(XXL)
    await evidence("02-pdp")
  })

  await step("หน้าค้นหา: หัวข้อ 30px/48px/600 และจำนวนผลลัพธ์ 12px/20px/400", async () => {
    await page.goto(`/${CC}/search?q=shirt`)
    expect(await font(page.getByTestId("search-page-title"))).toEqual(XXL_SEMI)
    expect(await font(page.getByTestId("search-result-count"))).toEqual(SMALL)
  })
})

test("AC-21: PDP ของสินค้า flash — banner 14px/24px/600, ราคา flash 24px/36px/600, นับถอยหลังและจำนวนคงเหลือ 12px/20px/400", async ({
  page,
  request,
  baseURL,
  evidence,
}) => {
  const product = await createFlashProduct(request, admin, "SFUI9B", 10)
  const campaignId = await createFlashCampaign(request, admin, "SFUI9B", product.productId, {
    total_cap: 5,
    show_countdown: true,
    show_remaining: true,
    banner_text: "แฟลชเซลทดสอบ SFUI-9b",
  })
  try {
    await signIn(page, baseURL!)
    const { product: created } = await ok(
      await request.get(`${BACKEND_URL}/admin/products/${product.productId}?fields=handle`, { headers: admin }),
      "product handle"
    )
    await page.goto(`/${CC}/products/${created.handle}`)
    const box = page.getByTestId("flash-sale")
    await expect(box.getByTestId("flash-remaining")).toBeVisible({ timeout: 15_000 })
    expect(await font(box.getByTestId("flash-banner"))).toEqual(BASE_SEMI)
    expect(await font(box.getByTestId("flash-price"))).toEqual(XL_SEMI)
    expect(await font(box.getByTestId("flash-countdown"))).toEqual(SMALL)
    expect(await font(box.getByTestId("flash-remaining"))).toEqual(SMALL)
    await evidence("03-pdp-flash")
  } finally {
    await endFlashCampaign(request, admin, campaignId)
  }
})

test.describe("viewport 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("AC-21: แถบปุ่มมือถือ (mobile-actions) 16px/24px/400", async ({ page, baseURL, evidence }) => {
    await signIn(page, baseURL!)
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await expect(page).toHaveURL(/[?&]v_id=/)
    const top = await page.evaluate(
      () => document.querySelector('[data-testid="add-product-button"]')!.getBoundingClientRect().top + window.scrollY
    )
    await page.evaluate((y) => window.scrollTo(0, y), top + 300)
    const bar = page.getByTestId("mobile-actions")
    await expect(bar).toBeVisible()
    expect(await font(bar)).toEqual(LARGE)
    await evidence("04-pdp-390-mobile-actions")
  })
})
