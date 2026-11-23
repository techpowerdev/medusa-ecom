import { APIResponse, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk, expectNoneLeft } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders } from "./support/medusa"
import { thaiRunWord } from "./support/search-word"

// CORE-75 (spec 01 กฎข้อ 133, AC-174): คำไทยที่อยู่กลางชื่อ (ไม่มีเว้นวรรค) ค้นเจอทุกหน้า และ drawer, /search?q=, /store?q= ได้ผลชุดเดียวกัน
// สินค้า 2 ชิ้นมีคำไทยเฉพาะของ run อยู่กลางชื่อ + 1 ชิ้นไม่มี; เทียบเป็น set ของ product handle
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-75" } })
test.describe.configure({ mode: "serial" })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin API ใน e2e
const ok = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

let admin: Headers
let run: string
let word: string
const handles: string[] = []
const productIds: string[] = []
let matching: string[] = []

/** handle จาก href `/th/products/<handle>` ของลิงก์สินค้าใน container (เรียงแล้ว ไม่ซ้ำ) */
const handlesIn = async (container: Locator) => {
  const hrefs = await container
    .locator(`a[href^="/${CC}/products/"]`)
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""))
  return Array.from(new Set(hrefs.map((href) => href.split("/").pop() ?? ""))).sort()
}

const drawerHandles = async (page: Page, query: string) => {
  await page.goto(`/${CC}`)
  await page.getByTestId("nav-search-button").click()
  await page.getByTestId("search-input").fill(query)
  await expect(page.getByTestId("search-results")).toBeVisible({ timeout: 10_000 })
  return handlesIn(page.getByTestId("search-drawer"))
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  const get = async (path: string) =>
    ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
  run = `${Date.now()}`
  // คำไทยเฉพาะของ run (ตัวเลขแปลงเป็นพยัญชนะไทย) — วางกลางชื่อโดยไม่เว้นวรรค; CORE-86: อักษรไม่ซ้ำกับ spec อื่น
  word = thaiRunWord("core75", run)

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")

  const create = async (title: string, key: string) => {
    const handle = `e2e-core75-${key}-${run}`
    const { product } = await ok(
      await request.post(`${BACKEND_URL}/admin/products`, {
        headers: admin,
        data: {
          title,
          handle,
          status: "published",
          shipping_profile_id: shipping_profiles[0].id,
          sales_channels: [{ id: sales_channels[0].id }],
          options: [{ title: "Size", values: ["M"] }],
          variants: [
            {
              title: "M",
              sku: `CORE75-${key}-${run}`,
              options: { Size: "M" },
              manage_inventory: false,
              prices: [{ currency_code: "thb", amount: 500 }],
            },
          ],
        },
      }),
      `สร้างสินค้า ${key}`
    )
    productIds.push(product.id)
    handles.push(handle)
    return handle
  }

  matching = [
    await create(`เสื้อ${word}คอกลม`, "a"),
    await create(`กางเกง${word}ขาสั้น`, "b"),
  ].sort()
  await create(`หมวกแก๊ป CORE75 ${run}`, "c")
})

test.afterAll(async ({ request }) => {
  await deleteAllThenExpectOk(
    request,
    admin,
    productIds.map((id) => `/admin/products/${id}`)
  )
  if (run) await expectNoneLeft(request, admin, run, "e2e-core75-")
})

test("AC-174: คำไทยกลางชื่อสินค้าได้ชุดเดียวกันจาก drawer, /th/search?q= และ /th/store?q=", async ({
  page,
  step,
  evidence,
}) => {
  await step("drawer: รอ index อัปเดตจนได้ 2 ชิ้นที่มีคำนั้นกลางชื่อ", async () => {
    await expect(async () => {
      expect(await drawerHandles(page, word)).toEqual(matching)
    }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })
    await evidence("01-drawer-thai-mid-word")
  })

  await step("/th/search?q=<คำ> ได้ชุดเดียวกัน", async () => {
    await page.goto(`/${CC}/search?q=${encodeURIComponent(word)}`)
    expect(await handlesIn(page.getByTestId("search-results"))).toEqual(matching)
    await evidence("02-search-page-thai-mid-word")
  })

  await step("/th/store?q=<คำ> ได้ชุดเดียวกัน", async () => {
    await page.goto(`/${CC}/store?q=${encodeURIComponent(word)}`)
    const list = page.getByTestId("products-list")
    await expect(list.locator(`a[href^="/${CC}/products/"]`)).toHaveCount(2, { timeout: 15_000 })
    expect(await handlesIn(list)).toEqual(matching)
    await evidence("03-store-thai-mid-word")
  })
})

// ชื่อ seed "เสื้อยืด Medusa": คำ "ยืด" อยู่ท้ายคำ — เดิมไม่เจอใน index ทุกหน้า
test('AC-174: drawer ค้น "ยืด" เจอสินค้า seed t-shirt', async ({ page }) => {
  expect(await drawerHandles(page, "ยืด")).toContain("t-shirt")
})
