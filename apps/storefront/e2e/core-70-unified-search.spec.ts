import { APIResponse, Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk, expectNoneLeft } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { STOREFRONT_COUNTRY as CC, Headers, adminHeaders } from "./support/medusa"

// CORE-70 (spec 01 กฎข้อ 128, AC-169): drawer, /search?q= และ /store?q= ใช้ POST /store/search เดียวกัน → ผลชุดเดียวกัน
// สินค้า 2 ชิ้นชื่อมีคำเดียวกัน (คำตัวอักษรเฉพาะของ run) + 1 ชิ้นไม่มี; เทียบเป็น set ของ product handle
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-70" } })
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
  // คำตัวอักษรล้วน (ไม่มีตัวเลข) ที่ไม่ซ้ำกับสินค้าอื่น — ตัวเลขของ run แปลงเป็นตัวอักษร a–j
  word = `corezeta${run.replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)))}`

  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")

  const create = async (title: string, key: string) => {
    const handle = `e2e-core70-${key}-${run}`
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
              sku: `CORE70-${key}-${run}`,
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

  matching = [await create(`เสื้อ ${word} หนึ่ง`, "a"), await create(`กางเกง ${word} สอง`, "b")].sort()
  await create(`หมวก CORE70 ${run}`, "c")
})

test.afterAll(async ({ request }) => {
  await deleteAllThenExpectOk(
    request,
    admin,
    productIds.map((id) => `/admin/products/${id}`)
  )
  if (run) await expectNoneLeft(request, admin, run, "e2e-core70-")
})

test("AC-169: คำค้นเดียวกันได้ชุดสินค้าเดียวกันจาก drawer, /th/search?q= และ /th/store?q=", async ({
  page,
  step,
  evidence,
}) => {
  await step("drawer: รอ index อัปเดตตาม event สร้างสินค้าจนได้ 2 ชิ้นที่มีคำนั้น", async () => {
    await expect(async () => {
      expect(await drawerHandles(page, word)).toEqual(matching)
    }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })
    await evidence("01-drawer-results")
  })

  await step("/th/search?q=<คำ> ได้ชุดเดียวกัน", async () => {
    await page.goto(`/${CC}/search?q=${encodeURIComponent(word)}`)
    await expect(page.getByTestId("search-result-count")).toContainText("2")
    expect(await handlesIn(page.getByTestId("search-results"))).toEqual(matching)
    await evidence("02-search-page-results")
  })

  await step("/th/store?q=<คำ>: ช่องค้นหามีคำนั้นและผลถูกกรองเป็นชุดเดียวกัน", async () => {
    await page.goto(`/${CC}/store?q=${encodeURIComponent(word)}`)
    await expect(page.getByTestId("store-search-input")).toHaveValue(word)
    const list = page.getByTestId("products-list")
    await expect(list.locator(`a[href^="/${CC}/products/"]`)).toHaveCount(2, { timeout: 15_000 })
    expect(await handlesIn(list)).toEqual(matching)
    await evidence("03-store-q-results")
  })
})

test("AC-169: พิมพ์คำค้นใน /th/store → URL ใช้ q", async ({ page }) => {
  await page.goto(`/${CC}/store`)
  await page.getByTestId("store-search-input").fill(word)
  await expect(page).toHaveURL(new RegExp(`[?&]q=${word}(&|$)`), { timeout: 10_000 })
  expect(new URL(page.url()).searchParams.has("product[query]")).toBe(false)
  await expect(page.getByTestId("products-list").locator(`a[href^="/${CC}/products/"]`)).toHaveCount(2, {
    timeout: 15_000,
  })
})

// ชื่อ seed เป็นภาษาไทย คำ "shirt" อยู่ใน handle (`t-shirt`) — เดิม drawer ไม่พบ แต่ /search (GET /store/products?q=) พบ 2
test('AC-169: drawer ค้น "shirt" ได้สินค้า seed อย่างน้อย 1 ชิ้น และตรงกับ /th/search?q=shirt', async ({ page }) => {
  const found = await drawerHandles(page, "shirt")
  expect(found).toContain("t-shirt")
  await page.goto(`/${CC}/search?q=shirt`)
  expect(await handlesIn(page.getByTestId("search-results"))).toEqual(found)
})
