import { APIRequestContext, APIResponse } from "@playwright/test"

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
  variantOf,
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
  // หน้ากลุ่ม join ด้วย cart ใหม่ที่ test เข้าถึง id ไม่ได้ จึงสร้าง cart t-shirt อีกใบ (cartReadyForPayment — default variant
  // ของ t-shirt) เพื่ออ่าน id ของ option Digital delivery จาก GET /store/shipping-options?cart_id= — ใช้แทนกันได้เพราะ seed
  // ให้ id ของ option เดียวกันกับทุก cart; optionIds ยัง assert ว่า Store API คืน Digital delivery ให้ cart t-shirt นี้
  // (พิสูจน์ว่าการซ่อนในหน้ากลุ่มมาจากการกรองของ storefront ไม่ใช่ Medusa) — CORE-33 (spec 01 กฎข้อ 91d)
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

// CORE-33 (spec 01 กฎข้อ 91b, AC-127): cart เก่าที่ค้าง Digital delivery (ถูกกรองออก) ถือว่ายังไม่เลือกวิธีส่ง
// cart t-shirt ที่มีที่อยู่แต่ยังไม่มี shipping method — Medusa 2.22.1 ตั้ง Digital delivery ได้เฉพาะเมื่อ cart ยังไม่มี method
// (cart ที่มี Standard อยู่แล้ว POST Digital delivery ได้ 200 แต่ cart ยังเป็น Standard) จึงไม่ใช้ cartReadyForPayment
async function tshirtCartWithoutMethod(request: APIRequestContext, pk: string, customer: Customer) {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const ok = async (res: APIResponse, what: string) => {
    expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
    return res.json()
  }
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC))
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  const { variantId } = await variantOf(request, pk, "t-shirt")
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, { headers, data: { variant_id: variantId, quantity: 1 } }),
    "add line item"
  )
  const address = { first_name: "สมชาย", last_name: "ใจดี", address_1: "1 ถนนสุขุมวิท", city: "กรุงเทพ", postal_code: "10110", country_code: CC }
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}`, {
      headers,
      data: { email: customer.email, shipping_address: address, billing_address: address },
    }),
    "update cart"
  )
  return cart.id as string
}

test.describe("CORE-33", () => {
  test.use({ evidenceTarget: { feature: "core", taskId: "CORE-33" } })

  test("AC-127 checkout: cart t-shirt ที่ค้าง Digital delivery ไม่มี radio ติ๊ก ปุ่ม disabled จนเลือก Standard", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(120_000)
    const pk = await publishableKey(request, await adminHeaders(request))
    const customer = await createCustomer(request, pk)
    const cartId = await tshirtCartWithoutMethod(request, pk, customer)
    const ids = await optionIds(request, pk, customer, cartId)
    const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
    // ตั้ง method เป็น Digital delivery ด้วย token ของเจ้าของ cart (จำลอง cart เก่าก่อน CORE-32)
    const set = await request.post(`${BACKEND_URL}/store/carts/${cartId}/shipping-methods`, {
      headers,
      data: { option_id: ids.digital },
    })
    expect(set.status(), `set digital: ${await set.text()}`).toBe(200)
    const shippingOptionIds = async () => {
      const res = await request.get(`${BACKEND_URL}/store/carts/${cartId}`, { headers })
      expect(res.status()).toBe(200)
      return ((await res.json()).cart.shipping_methods as { shipping_option_id: string }[]).map((m) => m.shipping_option_id)
    }
    expect(await shippingOptionIds()).toEqual([ids.digital])

    await signInAs(context, baseURL!, customer)
    await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])
    await page.goto(`/${CC}/checkout?step=delivery`)

    const container = page.getByTestId("delivery-options-container")
    const standard = container.locator(`[data-testid="delivery-option-radio"][data-option-id="${ids.standard}"]`)
    const submit = page.getByTestId("submit-delivery-option-button")
    await expect(standard).toBeVisible()
    await expect(container.locator('[aria-checked="true"], [checked]')).toHaveCount(0)
    await expect(submit).toBeDisabled()
    await evidence("03-checkout-stale-digital-not-selected")

    await standard.click()
    await expect(submit).toBeEnabled({ timeout: 15_000 })
    await expect.poll(shippingOptionIds).toContain(ids.standard)
    expect(await shippingOptionIds()).not.toContain(ids.digital)
  })
})
