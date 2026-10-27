import { Page } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  adminHeaders,
  createCustomer,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"

// CORE-24: spec 01 AC-94 (กฎข้อ 59) — ตัวเลือกจำนวนบน PDP ทั้งโหมด JS และ no-JS; หา element ด้วย data-testid เท่านั้น
// ข้อมูลตั้งต้นจาก seed (CORE-2): region Thailand, t-shirt
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-24" } })

const PRODUCT = "t-shirt"

/** line ของ cart ปัจจุบันใน browser (cookie `_medusa_cart_id`) อ่านด้วย token ของเจ้าของ cart */
async function cartLines(page: Page, customer: Customer, pk: string) {
  const cartId = (await page.context().cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  const res = await page.request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.status()).toBe(200)
  const items = (await res.json()).cart.items as { variant_id: string; quantity: number }[]
  return items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity }))
}

test("AC-94: (JS) เลือก 3 ใน product-quantity-select แล้วกดเพิ่มลง cart → cart มี line qty 3", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const { variantId } = await variantOf(request, pk, PRODUCT)
  await signInAs(context, baseURL!, customer)

  await step("PDP มีตัวเลือกจำนวน 1..10 ค่าเริ่มต้น 1", async () => {
    await page.goto(`/${CC}/products/${PRODUCT}`)
    const select = page.getByTestId("product-quantity-select")
    await expect(select).toHaveValue("1")
    await expect(select.locator("option")).toHaveText(Array.from({ length: 10 }, (_, i) => String(i + 1)))
  })

  await step("เลือก 3 แล้วกดเพิ่มลงตะกร้า (server action)", async () => {
    await page.getByTestId("product-quantity-select").selectOption("3")
    const done = page.waitForResponse((r) => r.request().headers()["next-action"] !== undefined)
    await page.getByTestId("add-product-button").click()
    await done
    await expect(page.getByTestId("add-product-button")).toBeEnabled()
    await evidence("01-js-quantity-3")
  })

  await step("cart มี line ของ variant นั้น quantity=3", async () => {
    expect(await cartLines(page, customer, pk)).toEqual([{ variant_id: variantId, quantity: 3 }])
  })
})

test.describe("ปิด JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("AC-94: (no-JS, ไม่ล็อกอิน) เลือก 2 แล้ว submit และ login → cart มี qty 2", async ({
    page,
    request,
    step,
    evidence,
  }) => {
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    const { variantId } = await variantOf(request, pk, PRODUCT)

    await step("PDP (ไม่มี JS) เลือก 2 แล้วกดเพิ่มลงตะกร้า → หน้า login คง variant และ quantity", async () => {
      await page.goto(`/${CC}/products/${PRODUCT}`)
      await page.getByTestId("product-quantity-select").selectOption("2")
      await page.getByTestId("add-product-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/account\\?add_variant=.+&add_quantity=2`))
      await expect(page.getByTestId("login-page")).toBeVisible()
      await evidence("02-nojs-login-quantity-2")
    })

    await step("ล็อกอิน (ไม่มี JS) → cart มี line ของ variant นั้น quantity=2", async () => {
      await page.getByTestId("email-input").fill(customer.email)
      await page.getByTestId("password-input").fill(customer.password)
      await page.getByTestId("sign-in-button").click()
      await expect(page).toHaveURL(new RegExp(`/${CC}/cart$`))
      expect(await cartLines(page, customer, pk)).toEqual([{ variant_id: variantId, quantity: 2 }])
    })
  })
})
