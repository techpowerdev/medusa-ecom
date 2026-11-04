import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, poolGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  publishableKey,
  signInAs,
  type Customer,
} from "./support/medusa"

// CORE-32 (spec 01 กฎข้อ 89, AC-125): cart ที่มีสินค้าต้องจัดส่ง (t-shirt) ไม่เห็น option "Digital delivery"
// ทั้งที่ checkout และหน้ากลุ่ม — id ของ option มาจาก GET /store/shipping-options?cart_id= ด้วย type.code (ไม่ match ข้อความ)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-32" } })

type Option = { id: string; type?: { code?: string } | null }

/** id ของ Standard และ Digital delivery (type.code ของ seed) สำหรับ cart นี้ */
async function optionIds(request: APIRequestContext, pk: string, customer: Customer, cartId: string) {
  const res = await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  expect(res.status(), `shipping options: ${await res.text()}`).toBe(200)
  const options = (await res.json()).shipping_options as Option[]
  const byCode = (code: string) => options.find((o) => o.type?.code === code)?.id
  const ids = { standard: byCode("standard"), digital: byCode("digital-delivery") }
  // Medusa ไม่กรองตาม profile → API ยังคืน Digital delivery ให้ cart นี้ (ถ้าไม่คืน test นี้ไม่ได้พิสูจน์อะไร)
  expect(ids.standard, "Standard ของ seed").toBeTruthy()
  expect(ids.digital, "Digital delivery ของ seed").toBeTruthy()
  return ids as { standard: string; digital: string }
}

test("AC-125 checkout: ขั้น delivery ของ cart t-shirt มี Standard ไม่มี Digital delivery", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const ids = await optionIds(request, pk, customer, cartId)
  await signInAs(context, baseURL!, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  await page.goto(`/${CC}/checkout?step=delivery`)
  const radio = (id: string) => page.locator(`[data-testid="delivery-option-radio"][data-option-id="${id}"]`)
  await expect(radio(ids.standard)).toBeVisible()
  await expect(radio(ids.digital)).toHaveCount(0)
  await evidence("01-checkout-delivery-no-digital")
})

test("AC-125 หน้ากลุ่ม: หลังกด group-shipping-load ไม่มี option ของ Digital delivery", async ({
  page,
  context,
  request,
  baseURL,
  evidence,
}) => {
  test.setTimeout(120_000)
  const ctx = await poolGroup(request)
  const customer = await createCustomer(request, ctx.pk)
  await addAddresses(request, ctx.pk, customer, [
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "1 ถนนสุขุมวิท", city: "กรุงเทพ", postal_code: "10110", phone: "0811111111" },
  ])
  const ids = await optionIds(request, ctx.pk, customer, await cartReadyForPayment(request, ctx.pk, customer))
  await signInAs(context, baseURL!, customer)

  await page.goto(`/${CC}/g/${ctx.token}`)
  await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: /^S$/ }).click()
  await page.getByTestId("group-add-variant").click()
  await expect(page.getByTestId("group-selection-item")).toHaveCount(1)
  await page.getByTestId("group-shipping-load").click()

  const shipping = page.getByTestId("group-shipping-option")
  await expect(shipping).toBeVisible()
  await expect(shipping.locator(`option[value="${ids.standard}"]`)).toHaveCount(1)
  await expect(shipping.locator(`option[value="${ids.digital}"]`)).toHaveCount(0)
  await evidence("02-group-shipping-no-digital")
})
