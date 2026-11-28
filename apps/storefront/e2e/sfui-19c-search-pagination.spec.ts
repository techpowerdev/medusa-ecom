import { Locator, Page } from "@playwright/test"

import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  type Headers,
  adminHeaders,
  createCustomer,
  ok,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-19c (spec 09 กฎ 64–66, AC-60 (2) — ADR-034 D4): ช่องค้นหาเป็น `ui/input` + `Button` (หน้า /search) และ `ui/input-group`
// (store) ตามตัวอย่าง docs; แบ่งหน้าเป็น `pagination` ของ shadcn — ค่าที่คาดคือค่าที่ component render จริง (`h-9`/`size-9` = 36px)
// ลิงก์เลขหน้า (ไม่มี testid ต่อลิงก์) หาด้วย role + ชื่อภายใน testid ของ nav แบบ AC-177
test.use({
  evidenceTarget: { feature: "storefront-consistency", taskId: "SFUI-19c" },
  viewport: { width: 1280, height: 800 },
})

const box = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { height: s.height, width: s.width }
  })

/**
 * ไม่มีข้อความอังกฤษตายตัวของ `PaginationPrevious`/`PaginationNext`/`PaginationEllipsis`/`Pagination` ในหน้า:
 * textContent ของ nav (รวม sr-only), ข้อความที่ render ของหน้า (`innerText` — textContent ของ body มี script ของ Next) และทุก aria-label
 */
async function expectNoEnglishPagination(page: Page, nav: Locator) {
  const navText = (await nav.textContent()) ?? ""
  expect(navText).not.toMatch(/Previous|Next|More pages|pagination/)
  const found = await page.evaluate(() => {
    const words = /Previous|Next|More pages|pagination/
    const hits: string[] = []
    if (words.test(document.body.innerText)) hits.push("innerText")
    for (const el of Array.from(document.querySelectorAll("[aria-label]"))) {
      const label = el.getAttribute("aria-label") ?? ""
      if (words.test(label)) hits.push(label)
    }
    return hits
  })
  expect(found).toEqual([])
}

/** nav ของแบ่งหน้า: `aria-label` ไทย, ลิงก์ทุกหน้า 36×36 มี href, หน้าปัจจุบันเท่านั้นที่ `aria-current="page"` */
async function expectShadcnPagination(nav: Locator, current: number) {
  await expect(nav).toHaveJSProperty("tagName", "NAV")
  await expect(nav).toHaveAttribute("aria-label", "แบ่งหน้า")
  await expect(nav).toHaveAttribute("data-slot", "pagination")
  await expect(nav.getByRole("button")).toHaveCount(0)
  const links = nav.getByRole("link")
  expect(await links.count()).toBeGreaterThanOrEqual(2)
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("data-slot", "pagination-link")
    await expect(link).toHaveAttribute("href", /.+/)
    await expect(link).toHaveAttribute("aria-label", /^หน้า \d+$/)
    expect(await box(link)).toEqual({ height: "36px", width: "36px" })
  }
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  await expect(nav.getByRole("link", { name: `หน้า ${current}`, exact: true })).toHaveAttribute("aria-current", "page")
}

test.describe("ช่องค้นหา (กฎ 65)", () => {
  test("หน้า /search: search-query-input เป็น ui/input และ search-submit เป็น Button สูง 36px", async ({ page }) => {
    await page.goto(`/${CC}/search?q=shirt`)
    const input = page.getByTestId("search-query-input")
    const submit = page.getByTestId("search-submit")
    await expect(input).toHaveAttribute("data-slot", "input")
    await expect(input).toHaveAttribute("type", "search")
    await expect(input).toHaveValue("shirt")
    expect((await box(input)).height).toBe("36px")
    await expect(submit).toHaveAttribute("data-slot", "button")
    await expect(submit).toHaveAttribute("type", "submit")
    expect((await box(submit)).height).toBe("36px")
  })

  test.describe("ปิด JavaScript", () => {
    test.use({ javaScriptEnabled: false })

    test("กรอกคำแล้ว submit → /th/search?q=<คำ> (GET form)", async ({ page }) => {
      await page.goto(`/${CC}/search`)
      await page.getByTestId("search-query-input").fill("shirt")
      await page.getByTestId("search-submit").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/search\\?q=shirt$`))
      await expect(page.getByTestId("search-query-input")).toHaveValue("shirt")
    })
  })

  test("/store: store-search-input อยู่ใน input-group สูง 36px, store-search-clear เป็น InputGroupButton icon-xs ใน addon กดแล้วช่องว่าง", async ({
    page,
  }) => {
    await page.goto(`/${CC}/store`)
    const input = page.getByTestId("store-search-input")
    const group = input.locator('xpath=ancestor::*[@data-slot="input-group"][1]')
    await expect(group).toHaveCount(1)
    expect((await box(group)).height).toBe("36px")
    await expect(input).toHaveAttribute("data-slot", "input-group-control")
    await expect(input).toHaveAttribute("aria-label", "ค้นหาสินค้า")
    await expect(group.locator('[data-slot="input-group-addon"] svg')).toHaveCount(1)

    const clear = page.getByTestId("store-search-clear")
    await expect(clear).toHaveCount(0)
    await input.fill("shirt")
    await expect(clear).toBeVisible()
    await expect(clear).toHaveAttribute("data-slot", "button")
    await expect(clear).toHaveAttribute("data-size", "icon-xs")
    await expect(clear).toHaveAttribute("aria-label", "ล้างคำค้นหา")
    await expect(clear.locator('xpath=ancestor::*[@data-slot="input-group-addon"][1]')).toHaveCount(1)
    await clear.click()
    await expect(input).toHaveValue("")
    await expect(clear).toHaveCount(0)
  })
})

test.describe("แบ่งหน้า (กฎ 66)", () => {
  test("/store: product-pagination เป็น pagination ของ shadcn, กดหน้า 2 → ผลชุดใหม่และ URL มีหน้า 2", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000)
    const admin: Headers = await adminHeaders(request)
    const run = `${Date.now()}`
    const get = async (path: string) => ok(await request.get(`${BACKEND_URL}${path}`, { headers: admin }), path)
    const { sales_channels } = await get("/admin/sales-channels?limit=1")
    const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
    const productIds: string[] = []
    try {
      // หน้าละ 12 (PRODUCT_LIMIT) — สร้างเพิ่ม 13 ชิ้นให้มี ≥ 2 หน้าแน่นอนโดยไม่พึ่งจำนวนสินค้าใน seed
      for (let i = 0; i < 13; i++) {
        const { product } = await ok(
          await request.post(`${BACKEND_URL}/admin/products`, {
            headers: admin,
            data: {
              title: `E2E SFUI19c ${run} ${i}`,
              handle: `e2e-sfui19c-${run}-${i}`,
              status: "published",
              shipping_profile_id: shipping_profiles[0].id,
              sales_channels: [{ id: sales_channels[0].id }],
              options: [{ title: "Size", values: ["M"] }],
              variants: [
                {
                  title: "M",
                  sku: `SFUI19C-${run}-${i}`,
                  options: { Size: "M" },
                  manage_inventory: false,
                  prices: [{ currency_code: "thb", amount: 100 }],
                },
              ],
            },
          }),
          "POST /admin/products"
        )
        productIds.push(product.id)
      }

      const nav = page.getByTestId("product-pagination")
      const cards = page.getByTestId("products-list").locator("a[href]")
      // index อัปเดตตาม event สร้างสินค้า → รอจนเห็นแบ่งหน้า
      await expect(async () => {
        await page.goto(`/${CC}/store`)
        await expect(nav).toBeVisible({ timeout: 5_000 })
      }).toPass({ intervals: [1_000, 2_000], timeout: 60_000 })

      await expectShadcnPagination(nav, 1)
      const page2 = nav.getByRole("link", { name: "หน้า 2", exact: true })
      await expect(page2).toHaveAttribute("href", /page(%5D|\])=2/)
      await expect(cards.first()).toBeVisible()
      const firstPage = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")))
      await expectNoEnglishPagination(page, nav)

      await page2.click()
      await expect(page).toHaveURL(/page(%5D|\])=2/)
      await expect(nav.getByRole("link", { name: "หน้า 2", exact: true })).toHaveAttribute("aria-current", "page")
      await expect(async () => {
        const secondPage = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")))
        expect(secondPage.length).toBeGreaterThan(0)
        expect(secondPage.filter((href) => firstPage.includes(href))).toEqual([])
      }).toPass({ timeout: 15_000 })
      await expectShadcnPagination(nav, 2)
    } finally {
      await deleteAllThenExpectOk(
        request,
        admin,
        productIds.map((id) => `/admin/products/${id}`)
      )
    }
  })

  test("/account/orders: orders-pagination เป็น pagination ของ shadcn, กดหน้า 2 → ?page=2", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(300_000)
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    await signInAs(context, baseURL!, customer)
    const ordersPath = `/${CC}/account/orders`
    const orders: { id: string }[] = []
    try {
      // หน้าละ 10 (ORDERS_PAGE_SIZE) → 11 ใบ = 2 หน้า
      for (let i = 0; i < 11; i++) orders.push(await placeOrder(request, pk, customer))
      await page.goto(ordersPath)
      const nav = page.getByTestId("orders-pagination")
      await expectShadcnPagination(nav, 1)
      const page2 = nav.getByRole("link", { name: "หน้า 2", exact: true })
      await expect(page2).toHaveAttribute("href", `${ordersPath}?page=2`)
      await expectNoEnglishPagination(page, nav)
      await page2.click()
      await expect(page).toHaveURL(new RegExp(`${ordersPath}\\?page=2$`))
      await expect(page.getByTestId("order-card")).toHaveCount(1)
      await expectShadcnPagination(nav, 2)
    } finally {
      await deleteAllThenExpectOk(
        request,
        admin,
        orders.map((o) => `POST /admin/orders/${o.id}/cancel`)
      )
    }
  })
})
