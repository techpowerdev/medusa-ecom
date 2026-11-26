import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
} from "./support/medusa"

// SFUI-9a (spec 09 กฎ 22, AC-21): ส่วนร่วม + layout + หน้าคงที่ หลังแทน utility ขนาดฟอนต์ของ starter ด้วย utility มาตรฐานของ Tailwind
// ค่าที่คาด = ค่าที่ render จริงที่ปลาย develop ก่อนแก้ (spec นี้ต้องผ่านทั้งบน commit ฐานและหลังแก้) — จุดตัวอย่างครบทุกขนาดในขอบเขต:
// 12px/20px/400, 14px/24px/400, 16px/24px/600, 30px/48px/600 (ขอบเขตนี้ไม่มีจุดที่เข้ากฎ 22b/22c)
test.use({ evidenceTarget: { feature: "storefront-ui", taskId: "SFUI-9a" } })

type Font = { size: string; lineHeight: string; weight: string }

const font = (locator: Locator): Promise<Font> =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el)
    return { size: s.fontSize, lineHeight: s.lineHeight, weight: s.fontWeight }
  })

const SMALL_REGULAR: Font = { size: "12px", lineHeight: "20px", weight: "400" }
const BASE_REGULAR: Font = { size: "14px", lineHeight: "24px", weight: "400" }
const LARGE_SEMI: Font = { size: "16px", lineHeight: "24px", weight: "600" }
const XXL_SEMI: Font = { size: "30px", lineHeight: "48px", weight: "600" }

const PRODUCT = "t-shirt"

/** ลูกค้าใหม่ที่ล็อกอินแล้ว — `lines` > 0 สร้าง cart ของลูกค้าที่มี t-shirt `lines` variant (qty 1) แล้วตั้ง cookie cart */
async function signedInCustomer(request: APIRequestContext, context: BrowserContext, baseURL: string, lines: number) {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  if (lines > 0) {
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers })).json()
    const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
    const created = await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } })
    expect(created.status(), "create cart").toBe(200)
    const cartId: string = (await created.json()).cart.id
    const products = await request.get(`${BACKEND_URL}/store/products?handle=${PRODUCT}&fields=id,*variants`, { headers })
    const [product] = (await products.json()).products
    for (const variant of product.variants.slice(0, lines)) {
      const res = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
        headers,
        data: { variant_id: variant.id, quantity: 1 },
      })
      expect(res.status(), "add line item").toBe(200)
    }
    await signInAs(context, baseURL, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL }])
  } else {
    await signInAs(context, baseURL, customer)
  }
}

/** ลบ line เป็น server action — ตอบ 500 ครั้งเดียวให้ DeleteButton แสดง error (วิธีเดียวกับ core-19c) */
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
}

test("AC-21: หน้า 404, นโยบาย, skeleton ของ store และ footer คงขนาดตัวอักษร/ระยะบรรทัด/น้ำหนักเดิม", async ({
  page,
  step,
  evidence,
}) => {
  await step("404 ของ app (URL ที่ไม่มี route): หัวข้อ 30px/48px/600, คำอธิบาย 12px/20px/400", async () => {
    await page.goto(`/${CC}/sfui-9a-no-such-page`)
    await expect(page.getByTestId("not-found-title")).toBeVisible()
    // app/not-found ไม่อยู่ใต้ layout ของ (main) — ไม่มี nav
    await expect(page.getByTestId("nav-cart-link")).toHaveCount(0)
    expect.soft(await font(page.getByTestId("not-found-title"))).toEqual(XXL_SEMI)
    expect.soft(await font(page.getByTestId("not-found-description"))).toEqual(SMALL_REGULAR)
  })

  await step("404 ของ (main) (สินค้าที่ไม่มี → notFound()): หัวข้อ 30px/48px/600, คำอธิบาย 12px/20px/400", async () => {
    await page.goto(`/${CC}/products/sfui-9a-no-such-product`)
    await expect(page.getByTestId("not-found-title")).toBeVisible()
    // (main)/not-found อยู่ใต้ layout ของ (main) (มี nav) ต่างจาก app/not-found — ยืนยันว่าเป็นหน้าของ (main)
    await expect(page.getByTestId("nav-cart-link")).toBeVisible()
    expect.soft(await font(page.getByTestId("not-found-title"))).toEqual(XXL_SEMI)
    expect.soft(await font(page.getByTestId("not-found-description"))).toEqual(SMALL_REGULAR)
    await evidence("01-not-found")
  })

  await step("หน้านโยบาย /shipping: หัวข้อ 30px/48px/600, เนื้อหา 14px/24px/400 + footer 12px/20px/400", async () => {
    await page.goto(`/${CC}/shipping`)
    await expect(page.getByTestId("policy-title")).toBeVisible()
    expect.soft(await font(page.getByTestId("policy-title"))).toEqual(XXL_SEMI)
    expect.soft(await font(page.getByTestId("policy-content"))).toEqual(BASE_REGULAR)
    // กล่อง grid ของคอลัมน์ลิงก์ใน footer (พ่อของคอลัมน์ "บริการลูกค้า")
    expect.soft(await font(page.getByTestId("footer-customer-service").locator("xpath=../.."))).toEqual(SMALL_REGULAR)
    await evidence("02-policy-shipping")
  })

  await step("skeleton ของ store ระหว่างรอ /store/search: แถวราคาโครง 14px/24px/400", async () => {
    // ค้าง request search ไว้ให้ skeleton แสดงค้าง
    await page.route("**/store/search**", () => {})
    await page.goto(`/${CC}/store`)
    const loader = page.getByTestId("products-list-loader")
    await expect(loader).toBeVisible()
    expect.soft(await font(loader.locator("li > div > div").nth(1))).toEqual(BASE_REGULAR)
    await page.unroute("**/store/search**")
  })
})

test("AC-21: cart dropdown, หน้า cart, select ที่อยู่ใบเสร็จ คงขนาดตัวอักษร/ระยะบรรทัด/น้ำหนักเดิม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  await signedInCustomer(request, context, baseURL!, 2)

  await step("cart dropdown: หัวข้อ 16px/24px/600, ชื่อสินค้า/ราคา 14px/24px/400, ปุ่มลบ 12px/20px/400, ยอดรวม 16px/24px/600", async () => {
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(2)
    await page.getByTestId("nav-cart-link").hover()
    const dropdown = page.getByTestId("nav-cart-dropdown")
    await expect(dropdown.getByTestId("cart-item")).toHaveCount(2)
    expect.soft(await font(dropdown.locator("h3").first())).toEqual(LARGE_SEMI)
    const item = dropdown.getByTestId("cart-item").first()
    expect.soft(await font(item.getByTestId("product-link").locator(".."))).toEqual(BASE_REGULAR)
    expect.soft(await font(item.getByTestId("product-price"))).toEqual(BASE_REGULAR)
    expect.soft(await font(item.getByTestId("cart-item-remove-button").locator(".."))).toEqual(SMALL_REGULAR)
    expect.soft(await font(dropdown.getByTestId("cart-subtotal"))).toEqual(LARGE_SEMI)
    // กล่องส่วนท้ายของ dropdown (ปู่ของ cart-subtotal)
    expect.soft(await font(dropdown.getByTestId("cart-subtotal").locator("xpath=../.."))).toEqual(SMALL_REGULAR)
    await evidence("03-cart-dropdown")
  })

  await step("หน้า cart: ราคาต่อหน่วย/ราคารวม 14px/24px/400, ปุ่มลบ 12px/20px/400 และ error ของการลบ 12px/20px/400", async () => {
    await page.mouse.move(0, 400)
    const row = page.getByTestId("product-row").first()
    expect.soft(await font(row.getByTestId("product-unit-price").first())).toEqual(BASE_REGULAR)
    expect.soft(await font(row.getByTestId("product-price").first())).toEqual(BASE_REGULAR)
    expect.soft(await font(row.getByTestId("product-delete-button").locator(".."))).toEqual(SMALL_REGULAR)

    await failNextServerAction(page)
    await row.getByTestId("product-delete-button").click()
    const error = row.getByTestId("cart-item-remove-error")
    await expect(error).toBeVisible({ timeout: 5000 })
    expect.soft(await font(error)).toEqual(SMALL_REGULAR)
  })

  await step("โปรไฟล์: select ประเทศของที่อยู่ใบเสร็จ (NativeSelect) 14px/24px/400 ทั้งกล่องและ <select>", async () => {
    await page.unroute("**/*")
    await page.goto(`/${CC}/account/profile`)
    const billing = page.getByTestId("account-billing-address-editor")
    await billing.getByTestId("edit-button").click()
    await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    const select = billing.getByTestId("billing-country-code-select")
    await expect(select).toBeVisible()
    expect.soft(await font(select.locator(".."))).toEqual(BASE_REGULAR)
    expect.soft(await font(select)).toEqual(BASE_REGULAR)
  })
})

test("AC-21: cart dropdown ของลูกค้าที่ยังไม่มีสินค้า: หัวข้อ 16px/24px/600 และป้ายจำนวน 0 เป็น 12px/20px/400", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  await signedInCustomer(request, context, baseURL!, 0)
  await step("เปิด dropdown ของตะกร้าว่าง", async () => {
    await page.goto(`/${CC}/store`)
    await page.getByTestId("nav-cart-link").hover()
    const dropdown = page.getByTestId("nav-cart-dropdown")
    await expect(dropdown).toBeVisible()
    expect.soft(await font(dropdown.locator("h3").first())).toEqual(LARGE_SEMI)
    // ป้ายวงกลม "0" ไม่มี testid — เป็นลูกแรกของกล่องตะกร้าว่าง (กล่องที่สองของ dropdown ถัดจากหัวข้อ)
    expect.soft(await font(dropdown.locator("xpath=./div[2]/div[1]/div[1]"))).toEqual(SMALL_REGULAR)
  })
})
