import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
} from "./support/medusa"
import { chooseOption, expectSelected } from "./support/select"

// PAY-18: spec 06 AC-31 (กฎข้อ 20c) — cart-error-notice หายเมื่อลูกค้าแก้ตะกร้าสำเร็จครั้งแรก และ URL ไม่มี error
// (router.replace — ไม่เพิ่ม history) ทางแยกของ /api/payment-return และหน้า checkout ตรวจใน unit
// (`src/core-29-active-cart.test.ts`, `src/pay-12-checkout-return.test.ts`); หา element ด้วย data-testid เท่านั้น
test.use({ evidenceTarget: { feature: "payments", taskId: "PAY-18" } })

test("AC-31: แก้จำนวนสำเร็จ → cart-error-notice หายและ URL ไม่มี error", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const notice = page.getByTestId("cart-error-notice")
  const select = page.getByTestId("product-select-button")
  const lineQuantity = async () => {
    const { cart } = await ok(
      await request.get(`${BACKEND_URL}/store/carts/${cartId}`, {
        headers: { "x-publishable-api-key": pk, authorization: `Bearer ${customer.token}` },
        params: { fields: "items.quantity" },
      }),
      "read cart"
    )
    return cart.items[0].quantity as number
  }

  await step("เปิด /cart?error=refunded → เห็น notice", async () => {
    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/cart?error=refunded`)
    await expect(notice).toBeVisible()
    await expectSelected(select, "1")
  })
  const historyBefore = await page.evaluate(() => history.length)

  await step("แก้จำนวนเป็น 2 สำเร็จ → notice หาย, URL ไม่มี error, history ไม่เพิ่ม", async () => {
    // ก่อน hydrate selectOption เปลี่ยนแค่ DOM (review #287) — เลือกซ้ำจน backend ได้จำนวน 2 (idempotent)
    await expect(async () => {
      await chooseOption(select, "2")
      expect(await lineQuantity()).toBe(2)
    }).toPass({ timeout: 30_000 })
    await expect(notice).toHaveCount(0)
    await expect(page).toHaveURL((url) => url.pathname === `/${CC}/cart` && !url.searchParams.has("error"))
    await expectSelected(select, "2")
    expect(await page.evaluate(() => history.length)).toBe(historyBefore)
    await evidence("01-cart-error-notice-cleared")
  })

  await step("reload → ยังไม่มี notice", async () => {
    await page.reload()
    await expect(page.getByTestId("cart-container")).toBeVisible()
    await expect(notice).toHaveCount(0)
  })
})
