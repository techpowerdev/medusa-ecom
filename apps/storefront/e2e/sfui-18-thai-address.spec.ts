import { APIRequestContext, BrowserContext, Locator } from "@playwright/test"
import { Client } from "pg"

import { MISSING_ADDRESS_MESSAGE } from "../src/lib/util/address-required"
import { fieldErrorMessage } from "../src/lib/util/field-validation"

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
import { expectThai } from "./support/thai-text"
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

// SFUI-18b (spec 09 กฎ 52–54, AC-52): ทั้ง 5 ฟอร์ม — label/ลำดับ DOM แบบที่อยู่ไทย และค่าตำบล/แขวงที่กรอกถูกบันทึก (การจัดวาง 375/767/768/1280
// ตรวจใน sfui-12a/12b ส่วน AC-37)
const ADDRESS_1_LABEL = "บ้านเลขที่ หมู่ ซอย ถนน"
const SUBDISTRICT_LABEL = "ตำบล/แขวง"

/** ข้อความ label โดยไม่รวม * (aria-hidden) */
const labelText = (scope: Locator, id: string) =>
  scope.getByTestId(`${id}-label`).evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

/** testid เรียงตามลำดับ DOM (compareDocumentPosition) */
async function expectDomOrder(scope: Locator, ids: string[]) {
  const ok = await scope.evaluate(
    (root, list) =>
      list.every((id, i) => {
        if (i === 0) return true
        const a = root.querySelector(`[data-testid="${list[i - 1]}"]`)
        const b = root.querySelector(`[data-testid="${id}"]`)
        return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      }),
    ids
  )
  expect(ok, ids.join(" → ")).toBe(true)
}

/** label ของบ้านเลขที่…/ตำบลตามกฎ 53 และเป็นไทย */
async function expectAddressLabels(scope: Locator, address1: string, address2: string) {
  expect(await labelText(scope, address1)).toBe(ADDRESS_1_LABEL)
  expect(await labelText(scope, address2)).toBe(SUBDISTRICT_LABEL)
  await expectThai(scope.page(), [`${address1}-label`, `${address2}-label`])
}

const fill = async (scope: Locator, values: Record<string, string>) => {
  for (const [id, value] of Object.entries(values)) await scope.getByTestId(id).fill(value)
}

test("AC-52: checkout ที่อยู่จัดส่ง + ใบเสร็จ — ลำดับ/label แบบไทย และตำบลที่กรอกลง cart", async ({ page, context, request, baseURL, step }) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  const main = page.locator("main")

  await step("ที่อยู่จัดส่ง: ลำดับ DOM และ label", async () => {
    await expectDomOrder(main, [
      "shipping-first-name-input",
      "shipping-last-name-input",
      "shipping-company-input",
      "shipping-address-input",
      "shipping-address-2-input",
      "shipping-city-input",
      "shipping-province-input",
      "shipping-postal-code-input",
      "shipping-email-input",
      "shipping-phone-input",
    ])
    await expectAddressLabels(main, "shipping-address-input", "shipping-address-2-input")
    await expect(page.getByTestId("shipping-address-2-input")).toHaveAttribute("name", "shipping_address.address_2")
    await expect(page.getByTestId("shipping-address-2-input")).toHaveAttribute("autocomplete", "address-level3")
    await expect(main.locator('input[name="shipping_address.address_2"]'), "ไม่มี name ซ้ำ (hidden ของ 18a ถูกแทนแล้ว)").toHaveCount(1)
  })

  await step("ที่อยู่ใบเสร็จ: ลำดับ DOM และ label", async () => {
    await page.getByTestId("billing-address-checkbox").click()
    await expect(page.getByTestId("billing-first-name-input")).toBeVisible()
    await expectDomOrder(main, [
      "billing-first-name-input",
      "billing-last-name-input",
      "billing-company-input",
      "billing-address-input",
      "billing-address-2-input",
      "billing-city-input",
      "billing-province-input",
      "billing-postal-input",
      "billing-phone-input",
    ])
    await expectAddressLabels(main, "billing-address-input", "billing-address-2-input")
    await expect(main.locator('input[name="billing_address.address_2"]')).toHaveCount(1)
  })

  await step("กรอกตำบลแล้วส่ง → cart มี address_2 ที่กรอก", async () => {
    await fill(main, {
      "shipping-first-name-input": "สมหญิง",
      "shipping-last-name-input": "รักไทย",
      "shipping-address-input": "99/1 หมู่ 2",
      "shipping-address-2-input": "คลองเตยเหนือ",
      "shipping-city-input": "วัฒนา",
      "shipping-province-input": "กรุงเทพมหานคร", // SFUI-20a (กฎ 69)
      "shipping-postal-code-input": "10110",
      "billing-first-name-input": "สมหญิง",
      "billing-last-name-input": "รักไทย",
      "billing-address-input": "7 ถนนสีลม",
      "billing-address-2-input": "สุริยวงศ์",
      "billing-city-input": "บางรัก",
      "billing-province-input": "กรุงเทพมหานคร", // SFUI-20a (กฎ 69)
      "billing-postal-input": "10500",
    })
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=delivery/)
    const { cart } = await ok(
      await request.get(`${BACKEND_URL}/store/carts/${await cartIdOf(context)}?fields=id,*shipping_address,*billing_address`, {
        headers: headersOf(pk, customer),
      }),
      "cart"
    )
    expect(cart.shipping_address.address_2).toBe("คลองเตยเหนือ")
    expect(cart.billing_address.address_2).toBe("สุริยวงศ์")
  })
})

test("AC-52: บัญชี — เพิ่ม/แก้ที่อยู่ และที่อยู่ใบเสร็จของโปรไฟล์: ลำดับ/label แบบไทย และตำบลที่กรอกถูกบันทึก", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  await signInAs(context, baseURL!, customer)
  const ACCOUNT_ORDER = [
    "first-name-input",
    "last-name-input",
    "company-input",
    "address-1-input",
    "address-2-input",
    "city-input",
    "state-input",
    "postal-code-input",
    "phone-input",
  ]
  const addresses = async () =>
    (await ok(await request.get(`${BACKEND_URL}/store/customers/me/addresses`, { headers: headersOf(pk, customer) }), "addresses"))
      .addresses as { id: string; address_2: string | null; is_default_billing: boolean }[]

  await step("add-address: ลำดับ/label แล้วบันทึก → address_2 ใน API", async () => {
    await page.goto(`/${CC}/account/addresses`)
    await page.getByTestId("add-address-button").click()
    const modal = page.getByTestId("add-address-modal")
    await expect(modal).toBeVisible()
    await expectDomOrder(modal, ACCOUNT_ORDER)
    await expectAddressLabels(modal, "address-1-input", "address-2-input")
    await fill(modal, {
      "first-name-input": "สมหญิง",
      "last-name-input": "รักไทย",
      "address-1-input": "99/1 หมู่ 2",
      "address-2-input": "คลองเตยเหนือ",
      "city-input": "วัฒนา",
      "state-input": "กรุงเทพมหานคร", // SFUI-20a (กฎ 69)
      "postal-code-input": "10110",
    })
    await modal.getByTestId("save-button").click()
    await expect(modal).toBeHidden()
    await expect.poll(async () => (await addresses()).map((a) => a.address_2)).toEqual(["คลองเตยเหนือ"])
  })

  await step("edit-address-modal: ลำดับ/label แล้วแก้ตำบล → address_2 ใน API เปลี่ยน", async () => {
    await page.getByTestId("address-edit-button").first().click()
    const modal = page.getByTestId("edit-address-modal")
    await expect(modal).toBeVisible()
    await expectDomOrder(modal, ACCOUNT_ORDER)
    await expectAddressLabels(modal, "address-1-input", "address-2-input")
    await expect(modal.getByTestId("address-2-input")).toHaveValue("คลองเตยเหนือ")
    await modal.getByTestId("address-2-input").fill("คลองตันเหนือ")
    await modal.getByTestId("save-button").click()
    await expect(modal).toBeHidden()
    await expect.poll(async () => (await addresses()).map((a) => a.address_2)).toEqual(["คลองตันเหนือ"])
  })

  await step("profile-billing-address: ลำดับ/label แล้วบันทึก → ที่อยู่ใบเสร็จมี address_2", async () => {
    await page.goto(`/${CC}/account/profile`)
    const billing = page.getByTestId("account-billing-address-editor")
    await billing.getByTestId("edit-button").click()
    await expect(billing.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await expectDomOrder(billing, [
      "billing-first-name-input",
      "billing-last-name-input",
      "billing-company-input",
      "billing-address-1-input",
      "billing-address-2-input",
      "billing-city-input",
      "billing-province-input",
      "billing-postcal-code-input",
      "billing-phone-input",
    ])
    await expectAddressLabels(billing, "billing-address-1-input", "billing-address-2-input")
    await fill(billing, {
      "billing-first-name-input": "สมหญิง",
      "billing-last-name-input": "รักไทย",
      "billing-address-1-input": "7 ถนนสีลม",
      "billing-address-2-input": "สุริยวงศ์",
      "billing-city-input": "บางรัก",
      "billing-province-input": "กรุงเทพมหานคร", // SFUI-20a (กฎ 69)
      "billing-postcal-code-input": "10500",
      "billing-phone-input": "0812345678",
    })
    await billing.getByTestId("save-button").click()
    await expect.poll(async () => (await addresses()).find((a) => a.is_default_billing)?.address_2).toBe("สุริยวงศ์")
  })
})

// SFUI-18c (spec 09 กฎ 55, AC-53; Q-R49-4 owner: ตำบลบังคับ): ช่องตำบลว่าง → error ระดับช่อง (กฎ 32b) จาก label จริง;
// ช่องว่างล้วนผ่าน `required` ของ browser ได้ → server ตอบ MISSING_ADDRESS_MESSAGE; ที่อยู่เดิมที่ไม่มี address_2 ต้องกรอกตำบลก่อนส่ง
const VALUE_MISSING = { valid: false, valueMissing: true, typeMismatch: false, patternMismatch: false }

test("AC-53: checkout — ตำบลว่าง → error ใต้ช่อง, ช่องว่างล้วน → MISSING_ADDRESS_MESSAGE, ที่อยู่เดิมไม่มี address_2 ต้องกรอกตำบล", async ({
  page,
  context,
  request,
  baseURL,
  step,
}) => {
  test.setTimeout(150_000)
  const pk = await publishableKey(request, await adminHeaders(request))
  const customer = await createCustomer(request, pk)
  // ที่อยู่ที่บันทึกไว้ก่อนรอบ 49 (ไม่มี address_2)
  await addAddresses(request, pk, customer, [
    // SFUI-20a (กฎ 69): จังหวัดบังคับ — fixture มีจังหวัด (test นี้ตรวจเฉพาะตำบล)
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "11 ถนนพระราม 4", city: "วัฒนา", province: "กรุงเทพมหานคร", postal_code: "10110", phone: "0812345678" },
  ])
  await signInAs(context, baseURL!, customer)
  await page.goto(`/${CC}/products/t-shirt`)
  await addToCartFromPdp(page, { request, pk, customer })
  await page.goto(`/${CC}/checkout?step=address`)
  const main = page.locator("main")
  const subdistrict = page.getByTestId("shipping-address-2-input")
  const subdistrictError = page.getByTestId("shipping-address-2-input-error")
  const cartAddress2 = async () =>
    (
      await ok(
        await request.get(`${BACKEND_URL}/store/carts/${await cartIdOf(context)}?fields=id,*shipping_address`, { headers: headersOf(pk, customer) }),
        "cart"
      )
    ).cart.shipping_address?.address_2 ?? null

  await step("เลือกที่อยู่เดิม (ไม่มี address_2) แล้วส่ง → error ใต้ช่องตำบล = fieldErrorMessage จาก label จริง, ไม่ไปขั้นถัดไป", async () => {
    await page.getByTestId("shipping-address-select").click()
    await page.getByTestId("shipping-address-option").first().click()
    await expect(page.getByTestId("shipping-first-name-input")).toHaveValue("สมชาย")
    await expect(subdistrict).toHaveValue("")
    await expect(subdistrict).toHaveAttribute("required", "")
    await page.getByTestId("submit-address-button").click()
    const label = await labelText(main, "shipping-address-2-input")
    const expected = fieldErrorMessage(VALUE_MISSING, { label, control: "input" })
    expect(expected).toBeTruthy()
    await expect(subdistrictError).toHaveText(expected!)
    await expect(subdistrict).toBeFocused()
    await expect(page).toHaveURL(/step=address/)
  })

  await step("ตำบลเป็นช่องว่างล้วน → address-error-message = MISSING_ADDRESS_MESSAGE และไม่บันทึกลง cart", async () => {
    await subdistrict.fill("   ")
    await expect(subdistrictError).toHaveCount(0)
    const before = await cartAddress2()
    const saved = waitForServerAction(page, (body) => body.includes(customer.email))
    await page.getByTestId("submit-address-button").click()
    await saved
    await expect(page.getByTestId("address-error-message")).toHaveText(MISSING_ADDRESS_MESSAGE)
    await expect(page).toHaveURL(/step=address/)
    expect(await cartAddress2()).toBe(before)
  })

  await step("กรอกตำบลแล้วส่ง → ไปขั้นจัดส่ง และ cart มี address_2", async () => {
    await subdistrict.fill("คลองเตย")
    await page.getByTestId("submit-address-button").click()
    await expect(page).toHaveURL(/step=delivery/)
    expect(await cartAddress2()).toBe("คลองเตย")
  })
})
