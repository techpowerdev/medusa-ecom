import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { THAI } from "./support/thai-text"

// CORE-19c: spec 01 AC-100 (กฎข้อ 64) — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt (มีหลาย variant)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-19c" } })

const PRODUCT = "t-shirt"

/** ลูกค้าใหม่ที่ล็อกอินแล้วและมี cart 2 line (qty 1, 1) — คืน headers + cart id ไว้ตรวจผลทาง backend */
async function customerWithTwoLines(request: APIRequestContext, context: BrowserContext, baseURL: string) {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers })).json()
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const created = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
  expect(created.status(), "create cart").toBe(200)
  const cartId: string = (await created.json()).cart.id
  const products = await request.get(`${BACKEND_URL}/store/products?handle=${PRODUCT}&fields=id,*variants`, { headers })
  const [product] = (await products.json()).products
  expect(product.variants.length, "seed t-shirt มีอย่างน้อย 2 variant").toBeGreaterThanOrEqual(2)
  for (const variant of product.variants.slice(0, 2)) {
    const res = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
      headers,
      data: { variant_id: variant.id, quantity: 1 },
    })
    expect(res.status(), "add line item").toBe(200)
  }
  await signInAs(context, baseURL, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  return { headers, cartId }
}

const backendLineCount = async (request: APIRequestContext, cartId: string, headers: Record<string, string>) =>
  ((await (await request.get(`${BACKEND_URL}/store/carts/${cartId}`, { headers })).json()).cart.items ?? []).length

const openDropdown = async (page: Page) => {
  await page.getByTestId("nav-cart-link").hover()
  const dropdown = page.getByTestId("nav-cart-dropdown")
  await expect(dropdown.getByTestId("cart-item")).toHaveCount(2)
  return dropdown
}

/**
 * การลบ line เป็น server action (POST ไปที่หน้าเดิมพร้อม header `next-action`) ซึ่งเรียก `DELETE` ทาง backend ฝั่ง server
 * browser จึง mock ได้ที่ request ของ action นั้น: ตอบ 500 ครั้งเดียว (เปิด route หลังหน้าโหลด cart เสร็จ ก่อนกดลบ)
 */
async function failNextServerAction(page: Page) {
  let failed = 0
  await page.route("**/*", async (route) => {
    const req = route.request()
    if (failed === 0 && req.method() === "POST" && req.headers()["next-action"] !== undefined) {
      failed++
      await route.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" })
      return
    }
    await route.fallback()
  })
  return () => failed
}

async function expectRemoveFailedVisibly(scope: Locator) {
  const error = scope.getByTestId("cart-item-remove-error")
  await expect(error).toBeVisible({ timeout: 5000 })
  expect((await error.textContent()) ?? "").toMatch(THAI)
  await expect(scope.getByTestId("cart-item-remove-spinner")).toHaveCount(0, { timeout: 5000 })
}

test("AC-100: ทุก line ใน cart dropdown (บน /th/cart) มี cart-item-remove-button และ line ในหน้า cart มี product-delete-button", async ({
  page,
  context,
  request,
  baseURL,
}) => {
  await customerWithTwoLines(request, context, baseURL!)
  await page.goto(`/${CC}/cart`)
  await expect(page.getByTestId("product-row")).toHaveCount(2)
  for (const row of await page.getByTestId("product-row").all()) {
    await expect(row.getByTestId("product-delete-button")).toHaveCount(1)
  }
  const dropdown = await openDropdown(page)
  for (const item of await dropdown.getByTestId("cart-item").all()) {
    await expect(item.getByTestId("cart-item-remove-button")).toHaveCount(1)
  }
})

test("AC-100: ลบใน cart dropdown แล้ว server action ตอบ 500 → error ไทย spinner หาย line ยังอยู่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const { headers, cartId } = await customerWithTwoLines(request, context, baseURL!)
  await page.goto(`/${CC}`)
  await expect.poll(async () => (await page.getByTestId("nav-cart-link").textContent()) ?? "").toContain("(2)")
  const dropdown = await openDropdown(page)
  const first = dropdown.getByTestId("cart-item").first()

  await step("กดลบ line แรกโดย server action ตอบ 500", async () => {
    const failedCount = await failNextServerAction(page)
    await first.getByTestId("cart-item-remove-button").click()
    await expect.poll(failedCount).toBe(1)
    await expectRemoveFailedVisibly(first)
    await evidence("01-dropdown-remove-error")
  })

  await step("line ยังอยู่ทั้งใน dropdown และ backend", async () => {
    await expect(dropdown.getByTestId("cart-item")).toHaveCount(2)
    expect(await backendLineCount(request, cartId, headers)).toBe(2)
  })
})

test("AC-100: ลบในหน้า /th/cart แล้ว server action ตอบ 500 → error ไทย spinner หาย line ยังอยู่", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  const { headers, cartId } = await customerWithTwoLines(request, context, baseURL!)
  await page.goto(`/${CC}/cart`)
  await expect(page.getByTestId("product-row")).toHaveCount(2)
  const first = page.getByTestId("product-row").first()

  const failedCount = await failNextServerAction(page)
  await first.getByTestId("product-delete-button").click()
  await expect.poll(failedCount).toBe(1)
  await expectRemoveFailedVisibly(first)
  await expect(page.getByTestId("product-row")).toHaveCount(2)
  expect(await backendLineCount(request, cartId, headers)).toBe(2)
  await evidence("02-cart-page-remove-error")
})
