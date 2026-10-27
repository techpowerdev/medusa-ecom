import type { APIRequestContext, Page } from "@playwright/test"
import { Client } from "pg"

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

// CORE-14d: spec 01 AC-92, AC-93 (กฎ 57–58; กฎ 58 ตามคำตัดสิน owner 2026-10-27: ล็อกอินอยู่แล้วต้องกดยืนยันก่อนเพิ่ม)
// หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14d" } })

const PRODUCT = "t-shirt"
const MISSING_VARIANT = "variant_ไม่มีจริง"
const CART_ITEM = "product-row"
const CART_SKELETON = "skeleton-cart-page"
const CONFIRM = "add-variant-confirm"

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

/** login แล้วรอ navigation ให้จบในตัว — fixture `step` ถ่าย screenshot ตอนจบ step (ถ่ายระหว่างเปลี่ยนหน้า = Protocol error) */
async function login(page: Page, customer: { email: string; password: string }, expectedUrl: RegExp) {
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
  await expect(page).toHaveURL(expectedUrl, { timeout: 10_000 })
  await page.waitForLoadState()
}

/** line item ทั้งหมดใน cart ของ customer (DB ของ e2e — CI ตั้ง DATABASE_URL) ใช้ยืนยันว่า GET ไม่แก้ cart */
async function cartLines(customerId: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rows } = await db.query(
      `select li.variant_id, li.quantity::int as quantity
         from cart c join cart_line_item li on li.cart_id = c.id and li.deleted_at is null
        where c.customer_id = $1 and c.deleted_at is null and c.completed_at is null
        order by li.created_at`,
      [customerId]
    )
    return rows as { variant_id: string; quantity: number }[]
  } finally {
    await db.end()
  }
}

async function customerId(request: APIRequestContext, token: string, pk: string) {
  const res = await request.get(`${BACKEND_URL}/store/customers/me`, {
    headers: { authorization: `Bearer ${token}`, "x-publishable-api-key": pk },
  })
  return (await res.json()).customer.id as string
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

    const me = await customerId(request, customer.token, pk)

    await step("เปิดหน้า login พร้อม variant ที่ค้างไว้ แล้ว login (ไม่มี JS) → ภายใน 10 วินาทีอยู่ที่ /cart", async () => {
      await page.goto(pendingAddPath(variantId, 2))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await login(page, customer, new RegExp(`/${CC}/cart$`))
    })

    await step("/cart มีรายการสินค้า quantity 2 และไม่มี skeleton ใน DOM", async () => {
      expect(await cartLines(me)).toEqual([{ variant_id: variantId, quantity: 2 }])
      await expect(page.getByTestId(CART_ITEM)).toHaveCount(1, { timeout: 10_000 })
      await expect(page.getByTestId(CART_SKELETON)).toHaveCount(0)
      await evidence("01-nojs-cart-after-login")
    })

    await step("response HTML ของ /cart มีรายการสินค้าโดยไม่ต้องรัน JS", async () => {
      const html = await (await page.request.get(page.url())).text()
      expect(html).toContain(`data-testid="${CART_ITEM}"`)
      expect(html).not.toContain(`data-testid="${CART_SKELETON}"`)
    })

    await step("qa D-1: กด Back กลับไปหน้าบัญชี → เห็นปุ่มยืนยัน ไม่เพิ่มซ้ำ (cart ยัง quantity 2)", async () => {
      await page.goBack()
      await expect(page.getByTestId(CONFIRM)).toBeVisible()
      expect(await cartLines(me)).toEqual([{ variant_id: variantId, quantity: 2 }])
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
      await login(page, customer, /add_error=1/)
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

    test(`AC-93: ล็อกอินแล้วเปิดลิงก์ add_variant → ไม่เพิ่มเอง แสดงปุ่มยืนยัน กดแล้วไป /cart (JS ${
      javaScriptEnabled ? "on" : "off"
    })`, async ({ page, context, request, baseURL, step, evidence }) => {
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const me = await customerId(request, customer.token, pk)
      const { variantId } = await variantOf(request, pk, PRODUCT)
      await signInAs(context, baseURL!, customer)

      await step("เปิด /account?add_variant=… (GET) → อยู่หน้าบัญชี เห็นปุ่มยืนยัน และ cart ไม่เปลี่ยน", async () => {
        await page.goto(pendingAddPath(variantId, 3))
        await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?`))
        await expect(page.getByTestId(CONFIRM)).toBeVisible()
        await expect(page.getByTestId(CONFIRM)).toHaveText(/[฀-๿]/)
        expect(await cartLines(me)).toEqual([])
        if (!javaScriptEnabled) {
          await evidence("03-logged-in-add-variant-confirm-nojs")
        }
      })

      await step("ลิงก์ GET /cart/pending-add (route เดิม) ไม่เพิ่มของลง cart", async () => {
        await page.request.get(`/${CC}/cart/pending-add?${new URLSearchParams({ add_variant: variantId })}`, {
          maxRedirects: 0,
        })
        expect(await cartLines(me)).toEqual([])
      })

      await step(`กดปุ่มยืนยัน${javaScriptEnabled ? " (ดับเบิลคลิก — ปุ่ม disable ระหว่างส่ง)" : ""} → /cart และ cart มี variant นั้น quantity 3`, async () => {
        await page.goto(pendingAddPath(variantId, 3))
        if (javaScriptEnabled) {
          await page.getByTestId(CONFIRM).dblclick()
        } else {
          await page.getByTestId(CONFIRM).click()
        }
        await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`), { timeout: 10_000 })
        await expect(page.getByTestId(CART_ITEM)).toHaveCount(1)
        expect(await cartLines(me)).toEqual([{ variant_id: variantId, quantity: 3 }])
      })
    })
  })
}

test("AC-93: ล็อกอินแล้วเปิด /account?add_variant=<ขายไม่ได้> → add-variant-error ไม่มีปุ่มยืนยัน", async ({
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

  await step("variant ไม่มีอยู่จริง → ข้อความ error ภาษาไทย ไม่มีปุ่มยืนยัน", async () => {
    await page.goto(pendingAddPath(MISSING_VARIANT, 1))
    const error = page.getByTestId("add-variant-error")
    await expect(error).toBeVisible()
    await expect(error).toHaveText(/[฀-๿]/)
    await expect(page.getByTestId(CONFIRM)).toHaveCount(0)
    await evidence("04-logged-in-add-variant-error")
  })
})
