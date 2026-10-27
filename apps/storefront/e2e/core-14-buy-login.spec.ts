import { Client } from "pg"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  variantOf,
} from "./support/medusa"

// CORE-14a: spec 01 AC-41, AC-42, AC-43, AC-56 (กฎ 24-25) — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14a" } })
test.describe.configure({ mode: "serial" })

const PRODUCT = "t-shirt"

/** query DB ของ Medusa ตรง (CI ตั้ง DATABASE_URL ให้ job e2e) */
async function dbRow<T extends object>(sql: string, values: unknown[] = []): Promise<T> {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    return (await db.query(sql, values)).rows[0] as T
  } finally {
    await db.end()
  }
}

/** นับเฉพาะ cart ที่เกี่ยวกับ test นี้ (กัน flaky เมื่อรันหลาย worker): cart ไม่มีเจ้าของที่สร้างหลัง `since` หรือ cart ของ customer */
const guestCartsSince = async (since: Date) =>
  Number(
    (await dbRow<{ n: string }>("select count(*) as n from cart where customer_id is null and created_at >= $1", [since])).n
  )
const customerCartCount = async (customerId: string) =>
  Number((await dbRow<{ n: string }>("select count(*) as n from cart where customer_id = $1", [customerId])).n)

test("AC-41: /buy ไม่มี session → login พร้อม return URL ไม่สร้าง cart; ล็อกอินแล้ว → checkout ด้วย cart ของลูกค้า", async ({
  page,
  context,
  request,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, PRODUCT)
  const buyPath = `/buy/${variantId}:2`
  const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const me = await (await request.get(`${BACKEND_URL}/store/customers/me`, { headers: auth })).json()
  const since = new Date()

  await step("GET /buy/<variant>:2 โดยไม่มี session → redirect ไปหน้า login ที่มี return URL", async () => {
    // CORE-14c (nit review #81): ตรวจ status + location ของ redirect แรกก่อนตามไปหน้าปลายทาง; route `/buy` ตอบ 303 เสมอ
    const res = await request.get(buyPath, { maxRedirects: 0 })
    expect(res.status()).toBe(303)
    const location = new URL(res.headers()["location"], "http://storefront")
    expect(location.pathname).toBe(`/${CC}/account`)
    expect(location.searchParams.get("return_to")).toBe(buyPath)

    await page.goto(buyPath)
    await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?return_to=`))
    await expect(page.getByTestId("login-page")).toBeVisible()
    expect(await guestCartsSince(since)).toBe(0)
    expect(await customerCartCount(me.customer.id)).toBe(0)
    await evidence("01-buy-guest-login")
  })

  await step("ล็อกอิน → 303 กลับ /buy → /th/checkout และ cart ใหม่เป็นของลูกค้า", async () => {
    await page.getByTestId("email-input").fill(customer.email)
    await page.getByTestId("password-input").fill(customer.password)
    await page.getByTestId("sign-in-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/checkout`))

    const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
    expect(cartId, "cart cookie").toBeTruthy()
    const owner = await dbRow<{ customer_id: string }>("select customer_id from cart where id = $1", [cartId])
    expect(owner.customer_id).toBe(me.customer.id)
    const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, { headers: auth })
    expect(res.status()).toBe(200)
    const { cart } = await res.json()
    expect(cart.items.map((i: { variant_id: string; quantity: number }) => [i.variant_id, i.quantity])).toEqual([
      [variantId, 2],
    ])
    expect(await customerCartCount(me.customer.id)).toBe(1)
    expect(await guestCartsSince(since)).toBe(0)
    await evidence("02-buy-checkout-after-login")
  })

  await step("ล็อกอินอยู่แล้ว → GET /buy ได้ 303 ไป /th/checkout ทันที", async () => {
    const res = await page.request.get(`/buy/${variantId}:1`, { maxRedirects: 0 })
    expect(res.status()).toBe(303)
    expect(new URL(res.headers()["location"]).pathname).toBe(`/${CC}/checkout`)
  })
})

test("AC-42, AC-56: UCP, cart/resume และหน้า order transfer → 404", async ({ request, step }) => {
  await step("UCP + cart/resume → 404 และไม่มี header Link rel=ucp", async () => {
    // /ucp ไม่ถูกยกเว้นจาก middleware แล้ว → 307/308 ไป /th/ucp/... ก่อน (ไม่ใช่ 2xx) แล้วปลายทางต้องเป็น 404
    // CORE-14c (nit review #81): assert redirect แรกก่อนตามไป
    const first = await request.get("/ucp/v1", { maxRedirects: 0 })
    expect([307, 308]).toContain(first.status())
    expect(new URL(first.headers()["location"], "http://storefront").pathname).toBe(`/${CC}/ucp/v1`)
    expect((await request.get("/ucp/v1")).status()).toBe(404)
    expect((await request.post("/ucp/v1/cart", { data: {} })).status()).toBe(404)
    const home = await request.get(`/${CC}`)
    expect(home.headers()["link"] ?? "").not.toMatch(/ucp/i)
    expect((await request.get("/.well-known/ucp", { maxRedirects: 0 })).status()).toBe(404)
    expect((await request.get(`/${CC}/cart/resume/cart_any`, { maxRedirects: 0 })).status()).toBe(404)
  })

  await step("order transfer → 404", async () => {
    for (const suffix of ["", "/accept", "/decline"]) {
      const res = await request.get(`/${CC}/order/order_any/transfer/token_any${suffix}`, { maxRedirects: 0 })
      expect(res.status(), suffix || "transfer").toBe(404)
    }
  })
})

test("AC-43: ไม่มี session แต่มี cookie cart ค้าง → หน้า cart ว่าง ไม่มี 5xx และ cookie ถูกล้าง", async ({
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
  const { variantId } = await variantOf(request, pk, PRODUCT)
  const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers: auth })).json()
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await (
    await request.post(`${BACKEND_URL}/store/carts`, { headers: auth, data: { region_id: region.id } })
  ).json()
  await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
    headers: auth,
    data: { variant_id: variantId, quantity: 1 },
  })

  await step("มีแค่ cookie `_medusa_cart_id` (ไม่มี `_medusa_jwt`) → เปิด /th/cart", async () => {
    await context.addCookies([{ name: "_medusa_cart_id", value: cart.id, url: baseURL! }])
    const res = await page.goto(`/${CC}/cart`)
    expect(res!.status()).toBeLessThan(500)
    await expect(page.getByTestId("empty-cart-message")).toBeVisible()
    await expect(page.getByTestId("product-row")).toHaveCount(0)
    await evidence("03-stale-cart-cookie-empty")
  })

  await step("cookie cart ถูกล้าง", async () => {
    const cookies = await context.cookies()
    expect(cookies.find((c) => c.name === "_medusa_cart_id")).toBeUndefined()
  })
})
