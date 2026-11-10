import { Client } from "pg"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-14b: spec 01 AC-44, AC-45 (กฎ 26) — หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-14b" } })

const PRODUCT = "t-shirt"
const MISSING_VARIANT = "variant_ไม่มีจริง"

/** สรุป cart ของ customer ใน DB (CI ตั้ง DATABASE_URL ให้ job e2e) — ใช้ยืนยันว่า "cart ไม่เปลี่ยน" */
async function cartSnapshot(customerId: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rows } = await db.query(
      `select c.id, coalesce(sum(li.quantity), 0)::int as qty, count(li.id)::int as lines
         from cart c left join cart_line_item li on li.cart_id = c.id and li.deleted_at is null
        where c.customer_id = $1 and c.deleted_at is null
        group by c.id order by c.id`,
      [customerId]
    )
    return rows
  } finally {
    await db.end()
  }
}

test.describe("ปิด JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("AC-44: no-JS Add to cart quantity 3 → HTML มีฟอร์ม login → ล็อกอินแล้ว cart มี quantity=3", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const admin = await adminHeaders(request)
    const pk = await publishableKey(request, admin)
    const customer = await createCustomer(request, pk)
    const { variantId } = await variantOf(request, pk, PRODUCT)
    const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }

    await step("PDP (ไม่มี JS) เลือก quantity 3 แล้วกด Add to cart → ไปหน้า login ที่คง variant และ quantity", async () => {
      await page.goto(`/${CC}/products/${PRODUCT}`)
      // CORE-24: เลือกจำนวนจากตัวเลือกจำนวนของ PDP
      await page.getByTestId("product-quantity-select").selectOption("3")
      await page.getByTestId("add-product-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?add_variant=.+&add_quantity=3`))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await evidence("01-nojs-login-after-add")
    })

    await step("response HTML ของ /account?add_variant=… มีฟอร์ม login (ไม่ใช่เพียง spinner)", async () => {
      const res = await page.request.get(page.url())
      expect(res.status()).toBe(200)
      const html = await res.text()
      expect(html).toContain('data-testid="login-page"')
      expect(html).toContain('data-testid="sign-in-button"')
      expect(html).toMatch(new RegExp(`name="add_quantity" value="3"`))
    })

    await step("ล็อกอิน (ไม่มี JS) → cart มี line ของ variant นั้น quantity=3", async () => {
      await page.getByTestId("email-input").fill(customer.email)
      await page.getByTestId("password-input").fill(customer.password)
      await page.getByTestId("sign-in-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))

      const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
      expect(cartId, "cart cookie").toBeTruthy()
      const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, { headers: auth })
      expect(res.status()).toBe(200)
      const items = (await res.json()).cart.items as { variant_id: string; quantity: number }[]
      expect(items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))).toEqual([
        { variant_id: variantId, quantity: 3 },
      ])
      await evidence("02-nojs-cart-quantity-3")
    })
  })
})

for (const javaScriptEnabled of [true, false]) {
  test.describe(`AC-45 (JS ${javaScriptEnabled ? "เปิด" : "ปิด"})`, () => {
    test.use({ javaScriptEnabled })

    test(`AC-45: ล็อกอินแล้วเปิด /account?add_variant=<ไม่มีจริง> → add-variant-error และ cart ไม่เปลี่ยน (JS ${
      javaScriptEnabled ? "on" : "off"
    })`, async ({ page, context, request, baseURL, step, evidence }) => {
      const admin = await adminHeaders(request)
      const pk = await publishableKey(request, admin)
      const customer = await createCustomer(request, pk)
      const auth = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
      const me = (await (await request.get(`${BACKEND_URL}/store/customers/me`, { headers: auth })).json()).customer
      // cart เดิมของลูกค้ามีสินค้า 1 ชิ้น (cookie ชี้ cart นี้) — ใช้ยืนยันว่าหน้า account ไม่แก้ cart
      const { variantId } = await variantOf(request, pk, PRODUCT)
      const { regions } = await (await request.get(`${BACKEND_URL}/store/regions`, { headers: auth })).json()
      const region = regions.find((r: { countries?: { iso_2: string }[] }) =>
        r.countries?.some((c) => c.iso_2 === CC)
      )
      const created = await request.post(`${BACKEND_URL}/store/carts`, { headers: auth, data: { region_id: region.id } })
      expect(created.status()).toBe(200)
      const cartId = (await created.json()).cart.id
      const line = await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, {
        headers: auth,
        data: { variant_id: variantId, quantity: 1 },
      })
      expect(line.status()).toBe(200)
      await signInAs(context, baseURL!, customer)
      await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
      const before = await cartSnapshot(me.id)
      expect(before).toEqual([{ id: cartId, qty: 1, lines: 1 }])

      await step("เปิดหน้าบัญชีพร้อม add_variant ที่ไม่มีอยู่จริง → เห็นข้อความ error ภาษาไทย", async () => {
        await page.goto(`/${CC}/account?${new URLSearchParams({ add_variant: MISSING_VARIANT })}`)
        const error = page.getByTestId("add-variant-error")
        await expect(error).toBeVisible()
        await expect(error).toHaveText(/[฀-๿]/)
        if (!javaScriptEnabled) {
          await evidence("03-add-variant-error-nojs")
        }
      })

      await step("cart ของลูกค้าไม่เปลี่ยน", async () => {
        expect(await cartSnapshot(me.id)).toEqual(before)
      })
    })
  })
}
