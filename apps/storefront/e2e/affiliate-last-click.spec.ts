import { createActiveAffiliate } from "./support/affiliate"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  createCustomer,
  publishableKey,
  shippingOptionId,
  signInAs,
  variantOf,
} from "./support/medusa"

// AF-3b (spec 05 กฎ 23, AC-21): last click — click Ann แล้ว add to cart, click Bob แล้ว checkout ทันทีโดยไม่ add เพิ่ม
// → cart.metadata.affiliate_token ตอน complete เป็นของ Bob และ attribution ของ order เป็นของ Bob
// หา element ด้วย data-testid (ADR-014)
test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-3b" } })

const PRODUCT = "t-shirt"
const HOUR = 60 * 60 * 1000

test("AF-3b: click Ann → add to cart → click Bob → checkout ทันที → order เป็นของ Bob (AC-21)", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const ann = await createActiveAffiliate(request, admin, "e2e-af3b-ann")
  const bob = await createActiveAffiliate(request, admin, "e2e-af3b-bob")
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, PRODUCT)
  const affCookie = async () => (await context.cookies()).find((c) => c.name === "aff")?.value
  const cartMetadata = async () => {
    const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
    const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,metadata`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
    })
    return (await res.json()).cart?.metadata
  }
  let annToken = ""
  let bobToken = ""

  await step("โปรแกรม published ครอบสินค้าที่จะซื้อ", async () => {
    const res = await request.post(`${BACKEND_URL}/admin/affiliate/programs`, {
      headers: admin,
      data: {
        name: "E2E AF-3b",
        starts_at: new Date(Date.now() - HOUR).toISOString(),
        ends_at: new Date(Date.now() + 24 * HOUR).toISOString(),
        commission_value: 10,
        scope: { variant_ids: [variantId] },
        status: "published",
      },
    })
    expect(res.status(), `create program: ${await res.text()}`).toBe(200)
  })

  await step("click /r/ann แล้วเพิ่มสินค้า → cart เป็นของ Ann", async () => {
    await page.goto(`/r/${ann.code}?to=/products/${PRODUCT}`)
    annToken = (await affCookie())!
    expect(annToken, "cookie aff ของ Ann").toBeTruthy()
    await signInAs(context, baseURL!, customer)
    await page.goto(`/${CC}/products/${PRODUCT}`)
    await page.getByTestId("add-product-button").click()
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await expect.poll(async () => (await cartMetadata())?.affiliate_token).toBe(annToken)
  })

  await step("click /r/bob (cookie เปลี่ยน) โดยไม่เพิ่มสินค้า → cart ยังเป็นของ Ann", async () => {
    await page.goto(`/r/${bob.code}?to=/products/${PRODUCT}`)
    bobToken = (await affCookie())!
    expect(bobToken).toBeTruthy()
    expect(bobToken).not.toBe(annToken)
    expect((await cartMetadata())?.affiliate_token).toBe(annToken)
  })

  let orderId = ""
  await step("checkout ทันทีด้วย manual payment", async () => {
    await page.goto(`/${CC}/cart`)
    await page.getByTestId("checkout-button").click()
    await page.getByTestId("shipping-first-name-input").fill("Somchai")
    await page.getByTestId("shipping-last-name-input").fill("Jaidee")
    await page.getByTestId("shipping-address-input").fill("1 Sukhumvit Rd")
    await page.getByTestId("shipping-postal-code-input").fill("10110")
    await page.getByTestId("shipping-city-input").fill("Bangkok")
    await page.getByTestId("shipping-country-select").selectOption(CC)
    await page.getByTestId("shipping-email-input").fill(customer.email)
    await page.getByTestId("submit-address-button").click()
    const standardId = await shippingOptionId(request, context, pk, customer, "Standard")
    await page.locator(`[data-testid="delivery-option-radio"][data-option-id="${standardId}"]`).click()
    await page.getByTestId("submit-delivery-option-button").click()
    await page.getByTestId("payment-option-pp_system_default").click()
    await page.getByTestId("submit-payment-button").click()
    await page.getByTestId("submit-order-button").click()
    await expect(page).toHaveURL(/\/order\/order_[^/]+\/confirmed/)
    orderId = page.url().match(/\/order\/(order_[^/]+)\/confirmed/)![1]
    await evidence("af3b-order-confirmed")
  })

  await step("metadata ของ cart ตอน complete (คัดลอกลง order) และ attribution เป็นของ Bob", async () => {
    const res = await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,metadata`, { headers: admin })
    expect((await res.json()).order.metadata?.affiliate_token).toBe(bobToken)
    await expect
      .poll(
        async () => {
          const entries = await request.get(`${BACKEND_URL}/admin/affiliate/entries?order_id=${orderId}`, {
            headers: admin,
          })
          const ids: string[] = ((await entries.json()).entries ?? []).map((e: { affiliate_id: string }) => e.affiliate_id)
          return ids.filter((id, i) => ids.indexOf(id) === i)
        },
        { timeout: 20_000 }
      )
      .toEqual([bob.id])
  })
})
