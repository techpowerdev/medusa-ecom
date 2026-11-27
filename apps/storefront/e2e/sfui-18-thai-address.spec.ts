import { APIRequestContext, BrowserContext, Locator } from "@playwright/test"
import { Client } from "pg"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, poolGroup, type AddressInput } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  adminHeaders,
  cartReadyForPayment,
  completeCart,
  createCustomer,
  ok,
  publishableKey,
  signInAs,
  type Customer,
} from "./support/medusa"
import { chooseOption } from "./support/select"
import { addToCartFromPdp, waitForServerAction } from "./support/server-action"

// SFUI-18a (spec 09 กฎ 56–57, AC-51): ตำบล/แขวง = address_2 ของ Medusa — ไหลจากที่อยู่ที่บันทึกไว้ลง cart/order/group cart
// และสรุปที่อยู่แสดงตามลำดับไทย (บ้านเลขที่… → ตำบล/แขวง → เขต/อำเภอ → จังหวัด → รหัสไปรษณีย์)

const THAI_ADDRESS = {
  first_name: "สมหญิง",
  last_name: "รักไทย",
  address_1: "99/1 หมู่ 2 ซ.สุขุมวิท 3",
  address_2: "คลองเตยเหนือ",
  city: "วัฒนา",
  province: "กรุงเทพมหานคร",
  postal_code: "10110",
  phone: "0812345678",
}
const ORDER = ["address_1", "address_2", "city", "province", "postal_code"] as const

const headersOf = (pk: string, customer: Customer) => ({ authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk })

/** ข้อความของ address_1 … postal_code อยู่ในกล่องตามลำดับ (indexOf เพิ่มขึ้น) */
async function expectThaiOrder(box: Locator, address: Record<(typeof ORDER)[number], string>) {
  const text = (await box.innerText()).replace(/\s+/g, " ")
  const positions = ORDER.map((field) => text.indexOf(address[field]))
  expect(positions.every((p) => p >= 0), `${text} มีทุกช่อง ${JSON.stringify(positions)}`).toBe(true)
  expect(positions, text).toEqual([...positions].sort((a, b) => a - b))
}

async function cartIdOf(context: BrowserContext) {
  const id = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(id, "cookie _medusa_cart_id").toBeTruthy()
  return id!
}

async function addStandardShipping(request: APIRequestContext, pk: string, customer: Customer, cartId: string) {
  const headers = headersOf(pk, customer)
  const { shipping_options } = await ok(await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, { headers }), "shipping options")
  const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
  await ok(await request.post(`${BACKEND_URL}/store/carts/${cartId}/shipping-methods`, { headers, data: { option_id: standard.id } }), "shipping method")
}

test("AC-51: ที่อยู่ที่บันทึกไว้มี address_2 → checkout ส่งลง cart, สรุปของ checkout และหน้าคำสั่งซื้อเรียงแบบไทย", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  const saved: AddressInput = THAI_ADDRESS
  await addAddresses(request, pk, customer, [saved])
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })

  let cartId = ""
  await step("เลือกที่อยู่ที่บันทึกไว้แล้วส่ง → cart.shipping_address.address_2 = ค่าที่บันทึก", async () => {
    await page.goto(`/${CC}/checkout?step=address`)
    await page.getByTestId("shipping-address-select").click()
    await page.getByTestId("shipping-address-option").first().click()
    await expect(page.getByTestId("shipping-first-name-input")).toHaveValue(THAI_ADDRESS.first_name)
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=delivery/)
    cartId = await cartIdOf(context)
    const { cart } = await ok(
      await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*shipping_address,*billing_address`, { headers: headersOf(pk, customer) }),
      "cart"
    )
    expect(cart.shipping_address.address_2).toBe(THAI_ADDRESS.address_2)
    expect(cart.billing_address.address_2).toBe(THAI_ADDRESS.address_2)
  })

  await step("สรุปที่อยู่จัดส่งของ checkout เรียงแบบไทย", async () => {
    await expectThaiOrder(page.getByTestId("shipping-address-summary"), THAI_ADDRESS)
    await evidence("18a-01-checkout-summary")
  })

  await step("หน้าคำสั่งซื้อ: shipping-address-summary เรียงแบบไทย", async () => {
    await addStandardShipping(request, pk, customer, cartId)
    const order = await completeCart(request, pk, customer, cartId)
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expectThaiOrder(page.getByTestId("shipping-address-summary"), THAI_ADDRESS)
    await evidence("18a-02-order-summary")
  })
})

test("AC-51: ที่อยู่เดิมไม่มี address_2/จังหวัด แสดงได้ ไม่มีจุลภาคหรือช่องว่างซ้อน", async ({ page, context, request, baseURL }) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  // cartReadyForPayment ตั้งที่อยู่แบบเดิม (ไม่มี address_2/province)
  const cartId = await cartReadyForPayment(request, pk, customer)
  await context.addCookies([{ name: "_medusa_cart_id", value: cartId, url: baseURL! }])

  const expectClean = async (box: Locator) => {
    const lines = (await box.innerText()).split("\n").map((l) => l.trim()).filter(Boolean)
    expect(lines, lines.join(" | ")).toContain("1 Sukhumvit Rd Bangkok 10110")
    for (const line of lines) expect(line, line).not.toMatch(/,\s*,|,\s*$|^,|\s{2}/)
  }
  await page.goto(`/${CC}/checkout?step=delivery`)
  await expectClean(page.getByTestId("shipping-address-summary"))

  const order = await completeCart(request, pk, customer, cartId)
  await page.goto(`/${CC}/account/orders/details/${order.id}`)
  await expectClean(page.getByTestId("shipping-address-summary"))
})

test("AC-51: group join ด้วยที่อยู่ที่มี address_2 → cart ของกลุ่มมี address_2", async ({ page, context, request, baseURL }) => {
  test.setTimeout(120_000)
  const ctx = await poolGroup(request, { max_units_per_person: 5 })
  const customer = await createCustomer(request, ctx.pk)
  const saved: AddressInput = THAI_ADDRESS
  const [addressId] = await addAddresses(request, ctx.pk, customer, [saved])
  await signInAs(context, baseURL!, customer)

  await page.goto(`/${CC}/g/${ctx.token}`)
  await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: /^S$/ }).click()
  await chooseOption(page.getByTestId("group-quantity"), "1")
  await page.getByTestId("group-add-variant").click()
  await chooseOption(page.getByTestId("group-address-select"), addressId)
  const prepared = waitForServerAction(page, (body) => body.includes(`"addressId":"${addressId}"`))
  await page.getByTestId("group-shipping-load").click()
  expect((await prepared).status(), "server action ของ prepareGroupCart").toBe(200)
  await expect(page.getByTestId("group-shipping-option")).toBeVisible()

  // cart ใหม่ของกลุ่มสร้างจาก Next server — อ่านจาก DB ของ backend (CI ตั้ง DATABASE_URL ให้ job e2e)
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rows } = await db.query(
      `select a.address_2 from cart c join customer u on u.id = c.customer_id join cart_address a on a.id = c.shipping_address_id
       where u.email = $1 and c.deleted_at is null order by c.created_at desc limit 1`,
      [customer.email]
    )
    expect(rows[0]?.address_2).toBe(THAI_ADDRESS.address_2)
  } finally {
    await db.end()
  }
})
