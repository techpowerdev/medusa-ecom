import { Client } from "pg"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  variantOf,
} from "./support/medusa"

// CORE-14c: spec 01 AC-76 (กฎข้อ 40) — หา element ด้วย data-testid เท่านั้น; ข้อมูลตั้งต้นจาก seed (CORE-2)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14c" } })

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

test("AC-76: login ขณะมี cookie cart ของ customer อื่น → login สำเร็จ, cookie ไม่ชี้ cart ของคนอื่น, cart นั้นยังเป็นของเจ้าของเดิม", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const a = await createCustomer(request, pk)
  const b = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, "t-shirt")
  const authB = { authorization: `Bearer ${b.token}`, "x-publishable-api-key": pk }
  const authA = { authorization: `Bearer ${a.token}`, "x-publishable-api-key": pk }
  const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers: authB })).json()
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart: cartB } = await (
    await request.post(`${BACKEND_URL}/store/carts`, { headers: authB, data: { region_id: region.id } })
  ).json()
  await request.post(`${BACKEND_URL}/store/carts/${cartB.id}/line-items`, {
    headers: authB,
    data: { variant_id: variantId, quantity: 1 },
  })
  const meB = await (await request.get(`${BACKEND_URL}/store/customers/me`, { headers: authB })).json()
  const meA = await (await request.get(`${BACKEND_URL}/store/customers/me`, { headers: authA })).json()

  await step("browser มี `_medusa_jwt` ค้าง (ใช้ไม่ได้แล้ว) + `_medusa_cart_id` เป็น cart ของ B → เปิดหน้า login", async () => {
    // มี jwt → middleware ของ AC-43 ไม่ล้าง cookie cart; token ใช้ไม่ได้ → หน้า account แสดงฟอร์ม login
    await context.addCookies([
      { name: "_medusa_jwt", value: "stale-token", url: baseURL! },
      { name: "_medusa_cart_id", value: cartB.id, url: baseURL! },
    ])
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("login-page")).toBeVisible()
  })

  await step("A ล็อกอินผ่านฟอร์ม → เข้าหน้า account ของ A ไม่มี error", async () => {
    await page.getByTestId("email-input").fill(a.email)
    await page.getByTestId("password-input").fill(a.password)
    await page.getByTestId("sign-in-button").click()
    await expect(page.getByTestId("customer-email")).toHaveText(a.email)
    await expect(page.getByTestId("login-error-message")).toHaveCount(0)
    await evidence("01-login-with-foreign-cart-cookie")
  })

  await step("cookie cart ถูกล้างหรือชี้ cart ของ A และ cart ของ B ยังเป็นของ B", async () => {
    const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
    if (cartId) {
      expect(cartId).not.toBe(cartB.id)
      expect(await cartOwner(cartId)).toBe(meA.customer.id)
    }
    expect(await cartOwner(cartB.id)).toBe(meB.customer.id)
  })
})
