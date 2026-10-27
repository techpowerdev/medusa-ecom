import type { APIRequestContext, Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-14d: spec 01 AC-92, AC-93 (กฎ 57–58) — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14d" } })

const PRODUCT = "t-shirt"
const MISSING_VARIANT = "variant_ไม่มีจริง"
const CART_ITEM = "product-row"
const CART_SKELETON = "skeleton-cart-page"

const pendingAddPath = (variantId: string, quantity: number) =>
  `/${CC}/account?${new URLSearchParams({
    add_variant: variantId,
    ...(quantity > 1 ? { add_quantity: String(quantity) } : {}),
  })}`

/** สินค้าชั่วคราว (ไม่ตัด stock) สำหรับลบระหว่างทาง — คืน id ของ product/variant */
async function createTempProduct(request: APIRequestContext, admin: Headers) {
  const get = async (path: string) => (await request.get(`${BACKEND_URL}${path}`, { headers: admin })).json()
  const { sales_channels } = await get("/admin/sales-channels?limit=1")
  const { shipping_profiles } = await get("/admin/shipping-profiles?type=default")
  const handle = `e2e-core14d-${Date.now()}`
  const res = await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants`, {
    headers: admin,
    data: {
      title: `E2E ${handle}`,
      handle,
      status: "published",
      shipping_profile_id: shipping_profiles[0].id,
      sales_channels: [{ id: sales_channels[0].id }],
      options: [{ title: "Size", values: ["M"] }],
      variants: [
        {
          title: "M",
          sku: handle.toUpperCase(),
          options: { Size: "M" },
          manage_inventory: false,
          prices: [{ currency_code: "thb", amount: 590 }],
        },
      ],
    },
  })
  expect(res.status()).toBe(200)
  const { product } = await res.json()
  return { productId: product.id as string, variantId: product.variants[0].id as string }
}

async function login(page: Page, customer: { email: string; password: string }) {
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
}

test.describe("ปิด JavaScript (AC-92)", () => {
  test.use({ javaScriptEnabled: false })

  test("AC-92: ไม่ล็อกอิน เปิด /account?add_variant=<ขายได้>&quantity 2 แล้ว login → /cart แสดง cart ไม่ค้าง skeleton", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const { variantId } = await variantOf(request, pk, PRODUCT)

    await step("เปิดหน้า login พร้อม variant ที่ค้างไว้ แล้ว login (ไม่มี JS)", async () => {
      await page.goto(pendingAddPath(variantId, 2))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await login(page, customer)
    })

    await step("ภายใน 10 วินาที อยู่ที่ /cart มีรายการสินค้า และไม่มี skeleton ใน DOM", async () => {
      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`), { timeout: 10_000 })
      await expect(page.getByTestId(CART_ITEM)).toHaveCount(1, { timeout: 10_000 })
      await expect(page.getByTestId(CART_SKELETON)).toHaveCount(0)
      await evidence("01-nojs-cart-after-login")
    })

    await step("response HTML ของ /cart มีรายการสินค้าโดยไม่ต้องรัน JS", async () => {
      const html = await (await page.request.get(page.url())).text()
      expect(html).toContain(`data-testid="${CART_ITEM}"`)
      expect(html).not.toContain(`data-testid="${CART_SKELETON}"`)
    })
  })

  test("AC-92: variant ถูกลบระหว่างทาง → หลัง login เห็น add-variant-error (ไม่กลืน error)", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const { productId, variantId } = await createTempProduct(request, admin)

    await step("เปิดหน้า login พร้อม variant ที่ยังขายได้ → ยังไม่มี error", async () => {
      await page.goto(pendingAddPath(variantId, 2))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await expect(page.getByTestId("add-variant-error")).toHaveCount(0)
    })

    await step("admin ลบสินค้าระหว่างที่ลูกค้ากำลัง login", async () => {
      const res = await request.delete(`${BACKEND_URL}/admin/products/${productId}`, { headers: admin })
      expect(res.status()).toBe(200)
    })

    await step("login → หน้าบัญชีพร้อม add_error และข้อความ error ภาษาไทย", async () => {
      await login(page, customer)
      await expect(page).toHaveURL(/add_error=1/)
      const error = page.getByTestId("add-variant-error")
      await expect(error).toBeVisible()
      await expect(error).toHaveText(/[฀-๿]/)
      await evidence("02-nojs-add-error-after-login")
    })
  })
})

for (const javaScriptEnabled of [true, false]) {
  test.describe(`AC-93 (JS ${javaScriptEnabled ? "เปิด" : "ปิด"})`, () => {
    test.use({ javaScriptEnabled })

    test(`AC-93: ล็อกอินแล้วเปิด /account?add_variant=<ขายได้> → /cart มี variant นั้น (JS ${
      javaScriptEnabled ? "on" : "off"
    })`, async ({ page, context, request, baseURL, step, evidence }) => {
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const { variantId } = await variantOf(request, pk, PRODUCT)
      const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
      await signInAs(context, baseURL!, customer)

      await step("เปิดหน้าบัญชีพร้อม add_variant → redirect ไป /cart", async () => {
        await page.goto(pendingAddPath(variantId, 1))
        await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))
        await expect(page.getByTestId(CART_ITEM)).toHaveCount(1)
        if (javaScriptEnabled) {
          await evidence("03-logged-in-add-variant-cart")
        }
      })

      await step("cart (cookie) มี line ของ variant นั้น quantity 1", async () => {
        const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
        expect(cartId, "cart cookie").toBeTruthy()
        const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, { headers: auth })
        expect(res.status()).toBe(200)
        const items = (await res.json()).cart.items as { variant_id: string; quantity: number }[]
        expect(items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))).toEqual([
          { variant_id: variantId, quantity: 1 },
        ])
      })
    })
  })
}

test("AC-93: ล็อกอินแล้วเปิด /account?add_variant=<ขายไม่ได้> → add-variant-error ไม่ redirect วน", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)

  await step("variant ไม่มีอยู่จริง → หน้าบัญชีพร้อม add_error และข้อความ error ภาษาไทย", async () => {
    await page.goto(pendingAddPath(MISSING_VARIANT, 1))
    await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?.*add_error=1`))
    const error = page.getByTestId("add-variant-error")
    await expect(error).toBeVisible()
    await expect(error).toHaveText(/[฀-๿]/)
    await evidence("04-logged-in-add-variant-error")
  })
})
