import type { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { isNavCartReadBody, isServerAction } from "./support/server-action"

// CORE-77 (spec 01 กฎข้อ 135, AC-176): อ่าน cart ของ nav ล้ม → "ตะกร้า" ไม่มีตัวเลข ไม่ค้าง aria-busy;
// เลิกล้มแล้วเปลี่ยนหน้า → อ่านใหม่ (≤ 2 request ต่อการเปลี่ยนหน้า) เห็นจำนวนจริง
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-77" } })

const QUANTITY = 2

async function customerWithCart(request: APIRequestContext) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "store regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  const { variantId } = await variantOf(request, pk, "t-shirt")
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity: QUANTITY },
    }),
    "add line item"
  )
  return { customer, cartId: cart.id as string }
}

test('AC-176: อ่าน cart ของ nav ล้ม (500) → "ตะกร้า" ไม่ค้าง aria-busy; เลิกล้มแล้วเปลี่ยนหน้า → เห็นจำนวนจริง', async ({
  page,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const { customer, cartId } = await customerWithCart(request)
  await signInAs(page.context(), baseURL!, customer)
  await page.context().addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  let failing = true
  let reads = 0
  await page.route("**/*", async (route) => {
    if (isServerAction(route.request(), isNavCartReadBody)) {
      reads++
      if (failing) {
        await route.fulfill({ status: 500, contentType: "text/plain", body: "mocked cart read failure" })
        return
      }
    }
    await route.fallback()
  })

  const link = page.getByTestId("nav-cart-link")

  await step('อ่าน cart ล้ม → ภายใน 5 วินาที "ตะกร้า" ไม่มีตัวเลขและไม่มี aria-busy', async () => {
    await page.goto(`/${CC}`)
    await expect.poll(() => reads, { message: "nav ยิงอ่าน cart แล้ว" }).toBeGreaterThan(0)
    await expect(link).toHaveText("ตะกร้า")
    await expect(link).not.toHaveAttribute("aria-busy")
    await expect(link).toHaveAttribute("href", `/${CC}/cart`)
    await evidence("failed-label")
  })

  await step(`เลิก mock แล้วเปลี่ยนหน้า → "ตะกร้า (${QUANTITY})" และอ่าน cart ≤ 2 ครั้ง`, async () => {
    failing = false
    reads = 0
    await page.getByTestId("nav-account-link").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account$`))
    await expect(link).toHaveText(`ตะกร้า (${QUANTITY})`)
    await expect(link).not.toHaveAttribute("aria-busy")
    expect(reads, "จำนวน request อ่าน cart ของ nav ต่อการเปลี่ยนหน้า").toBeLessThanOrEqual(2)
    await evidence("recovered-count")
  })
})
