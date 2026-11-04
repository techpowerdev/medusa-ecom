import type { APIRequestContext, APIResponse, BrowserContext, Page } from "@playwright/test"
import { Client } from "pg"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-29: spec 01 AC-122 (กฎข้อ 86; ADR-019 ทางเลือก B) — JWT หาย → cookie cart ถูกล้าง (AC-43) → login ใหม่แล้วได้ตะกร้าเดิมคืน
// จาก customer.metadata.active_cart_id; หา element ด้วย data-testid เท่านั้น; ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-29" } })

const PRODUCT = "t-shirt"

const auth = (pk: string, customer: Customer): Headers => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

const cartCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e (แบบเดียวกับ support/medusa.ts)
async function ok(res: APIResponse, what: string): Promise<any> {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}

async function metadataOf(request: APIRequestContext, headers: Headers) {
  const { customer } = await ok(
    await request.get(`${BACKEND_URL}/store/customers/me?fields=metadata`, { headers }),
    "customer metadata"
  )
  return (customer.metadata ?? {}) as Record<string, unknown>
}

async function setMetadata(request: APIRequestContext, headers: Headers, metadata: Record<string, unknown>) {
  await ok(await request.post(`${BACKEND_URL}/store/customers/me`, { headers, data: { metadata } }), "set metadata")
}

async function createCart(request: APIRequestContext, pk: string, headers: Headers) {
  const { variantId } = await variantOf(request, pk, PRODUCT)
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity: 1 },
    }),
    "add line item"
  )
  return cart.id as string
}

/** complete cart ผ่าน store API ด้วย manual payment ของ seed (pp_system_default) */
async function completeCart(request: APIRequestContext, headers: Headers, email: string, cartId: string) {
  const address = {
    first_name: "Somchai",
    last_name: "Jaidee",
    address_1: "1 Sukhumvit Rd",
    city: "Bangkok",
    postal_code: "10110",
    country_code: CC,
  }
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cartId}`, {
      headers,
      data: { email, shipping_address: address, billing_address: address },
    }),
    "update cart"
  )
  const { shipping_options } = await ok(
    await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, { headers }),
    "shipping options"
  )
  const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
      headers,
      data: { option_id: standard.id },
    }),
    "shipping method"
  )
  const { payment_collection } = await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } }),
    "payment collection"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      headers,
      data: { provider_id: "pp_system_default" },
    }),
    "payment session"
  )
  const completed = await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cartId}/complete`, { headers }),
    "complete cart"
  )
  expect(completed.type, JSON.stringify(completed)).toBe("order")
}

/** owner ของ cart จาก DB ของ Medusa ตรง (store API ไม่คืน `customer_id`; CI ตั้ง DATABASE_URL ให้ job e2e) */
async function cartOwner(cartId: string): Promise<string | null> {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    return (await db.query("select customer_id from cart where id = $1", [cartId])).rows[0]?.customer_id ?? null
  } finally {
    await db.end()
  }
}

/** login ผ่านฟอร์มหน้า account แล้วรอหน้า account ของลูกค้า */
async function loginViaForm(page: Page, customer: Customer) {
  await page.goto(`/${CC}/account`)
  await expect(page.getByTestId("login-page")).toBeVisible()
  await page.getByTestId("email-input").fill(customer.email)
  await page.getByTestId("password-input").fill(customer.password)
  await page.getByTestId("sign-in-button").click()
  await expect(page.getByTestId("customer-email")).toHaveText(customer.email)
  await expect(page.getByTestId("login-error-message")).toHaveCount(0)
}

/** ลบ JWT แล้วเปิด /th/cart → middleware ล้าง cookie cart ตาม AC-43 */
async function dropJwtAndOpenCart(page: Page, context: BrowserContext) {
  await context.clearCookies({ name: "_medusa_jwt" })
  await page.goto(`/${CC}/cart`)
  await expect.poll(() => cartCookie(context), "AC-43: cookie cart ถูกล้าง").toBeFalsy()
}

test("AC-122: ลบ JWT → login ใหม่ได้ตะกร้าเดิม; cart ที่ complete แล้วไม่ถูกกู้; key อื่นใน metadata ยังอยู่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const a = await createCustomer(request, pk)
  const headersA = auth(pk, a)
  await setMetadata(request, headersA, { keep_me: "yes" })
  let cartC = ""

  await step("A login แล้วเพิ่มสินค้า 1 line ผ่าน PDP → cookie cart C และ metadata.active_cart_id = C", async () => {
    await signInAs(context, baseURL!, a)
    await page.goto(`/${CC}/products/${PRODUCT}`)
    const add = page.getByTestId("add-product-button")
    await expect(add).toBeEnabled({ timeout: 10_000 })
    await add.click()
    await expect.poll(async () => (await page.getByTestId("nav-cart-link").textContent()) ?? "").toContain("(1)")
    cartC = (await cartCookie(context)) ?? ""
    expect(cartC, "cookie cart").toMatch(/^cart_/)
    const metadata = await metadataOf(request, headersA)
    expect(metadata.active_cart_id).toBe(cartC)
    expect(metadata.keep_me, "กฎข้อ 86e: key อื่นของ metadata ไม่หาย").toBe("yes")
  })

  await step("ลบ _medusa_jwt แล้วเปิด /th/cart → cookie cart ถูกล้าง (AC-43)", async () => {
    await dropJwtAndOpenCart(page, context)
  })

  await step("login ใหม่ผ่านฟอร์ม → cookie cart = C, /th/cart มีแถวสินค้าเดิม, nav-cart-link จำนวนเดิม", async () => {
    await loginViaForm(page, a)
    expect(await cartCookie(context)).toBe(cartC)
    await page.goto(`/${CC}/cart`)
    await expect(page.getByTestId("product-row")).toHaveCount(1)
    await expect.poll(async () => (await page.getByTestId("nav-cart-link").textContent()) ?? "").toContain("(1)")
    await evidence("01-cart-restored-after-login")
  })

  await step("C ถูก complete (manual payment) → ลบ JWT แล้ว login ใหม่ → ไม่มี cookie cart", async () => {
    await completeCart(request, headersA, a.email, cartC)
    await dropJwtAndOpenCart(page, context)
    await loginViaForm(page, a)
    expect(await cartCookie(context)).toBeUndefined()
    expect((await metadataOf(request, headersA)).keep_me).toBe("yes")
  })
})

test("AC-122: active_cart_id ของ A ชี้ cart ของ B → login สำเร็จ ไม่มี cookie cart และ cart ของ B ยังเป็นของ B", async ({
  page,
  context,
  request,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const a = await createCustomer(request, pk)
  const b = await createCustomer(request, pk)
  const cartB = await createCart(request, pk, auth(pk, b))
  await setMetadata(request, auth(pk, a), { active_cart_id: cartB })
  const meB = await ok(await request.get(`${BACKEND_URL}/store/customers/me`, { headers: auth(pk, b) }), "me B")

  await step("A login ผ่านฟอร์ม (ไม่มี cookie cart) → สำเร็จ ไม่มี cookie cart", async () => {
    await loginViaForm(page, a)
    expect(await cartCookie(context)).toBeUndefined()
    await evidence("02-foreign-active-cart-ignored")
  })

  await step("cart ของ B ยังมี customer_id = B", async () => {
    expect(await cartOwner(cartB)).toBe(meB.customer.id)
  })
})

test("AC-122: browser มี cookie cart D ของ A อยู่แล้วตอน login → cookie ยังเป็น D (ไม่ทับด้วย active_cart_id)", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const a = await createCustomer(request, pk)
  const headersA = auth(pk, a)
  const cartOther = await createCart(request, pk, headersA)
  const cartD = await createCart(request, pk, headersA)
  await setMetadata(request, headersA, { active_cart_id: cartOther })

  await step("JWT ค้าง (ใช้ไม่ได้) + cookie cart D → login ผ่านฟอร์ม → cookie ยังเป็น D", async () => {
    // มี jwt → middleware ของ AC-43 ไม่ล้าง cookie cart ตอนเปิดหน้า login
    await context.addCookies([
      { name: "_medusa_jwt", value: "stale-token", url: baseURL! },
      { name: "_medusa_cart_id", value: cartD, url: baseURL! },
    ])
    await loginViaForm(page, a)
    expect(await cartCookie(context)).toBe(cartD)
  })
})
