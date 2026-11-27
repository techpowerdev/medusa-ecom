import type { APIRequestContext, Locator, Page } from "@playwright/test"

import { PDP_QUANTITY_OPTIONS } from "../src/lib/util/pending-add-to-cart"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import { addAddresses, poolGroup } from "./support/group-buy"
import {
  STOREFRONT_COUNTRY as CC,
  type Customer,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  fulfillAndShip,
  ok,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// SFUI-12c (spec 09 รอบ 48 กฎ 28–31a, 33; AC-34 ส่วน 12c): ฟอร์มคืนสินค้า, ชุดช่องของ group buy join และ login/สมัครของ affiliate portal
// ใช้ `field` ของ shadcn — label เหนือช่อง ชิดซ้าย, labels[0] ชี้ label ของช่อง (คืนสินค้า: ต่อแถว id ไม่ซ้ำ), * เฉพาะช่องบังคับ, placeholder ตามตาราง inventory
// ชุด option ของทุก <select> ต้องเท่าเดิม (กฎ 31a) — test "option" ของแต่ละหน้าผ่านบน commit ฐานด้วย (ค่าที่คาดสร้างจากข้อมูลจริง ไม่ hard-code id)
test.use({ evidenceTarget: { feature: "storefront-forms", taskId: "SFUI-12c" } })

/** testid ของ control → บังคับกรอกหรือไม่ (ตาราง inventory ของ spec 09 รอบ 48) */
type Fields = Record<string, boolean>
const RETURN_ROW: Fields = { "return-item-quantity": false, "return-item-reason": false }
const AFFILIATE_LOGIN: Fields = { "affiliate-login-email": true, "affiliate-login-password": true }
const AFFILIATE_REGISTER: Fields = {
  "affiliate-register-name": true,
  "affiliate-register-code": true,
  "affiliate-register-email": true,
  "affiliate-register-password": true,
}

type Option = [value: string, text: string, disabled: boolean]
const optionsOf = (select: Locator): Promise<Option[]> =>
  select.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o): [string, string, boolean] => [o.value, (o.textContent ?? "").trim(), o.disabled])
  )

/** กล่องของ control — ช่องรหัสผ่านใช้กล่อง InputGroup ที่ครอบ <input> (กฎ 28) */
const boxOf = (control: Locator) =>
  control.evaluate((el) => {
    const box = (el.closest('[data-slot="input-group"]') ?? el).getBoundingClientRect()
    return { top: box.top, left: box.left }
  })

const labelText = (label: Locator) =>
  label.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    return (clone.textContent ?? "").trim()
  })

/** เกณฑ์เดียวกับ AC-28 ภายใน scope (ฟอร์มหรือแถวสินค้า) + ไม่มี placeholder (ตาราง inventory ของ 12c ไม่มีค่า) */
async function expectLabelAbove(scope: Locator, fields: Fields) {
  for (const [id, required] of Object.entries(fields)) {
    const control = scope.getByTestId(id)
    const label = scope.getByTestId(`${id}-label`)
    await expect(label, id).toBeVisible()
    const box = await boxOf(control)
    const l = (await label.boundingBox())!
    expect(l.y + l.height, `${id}: label อยู่เหนือช่อง`).toBeLessThanOrEqual(box.top + 0.5)
    expect(Math.abs(l.x - box.left), `${id}: label ชิดซ้ายเดียวกับช่อง`).toBeLessThanOrEqual(1)
    // labels[0] คือ label ของช่องนี้ใน scope เดียวกัน (แถวคืนสินค้าหลายแถวมี testid ซ้ำกันได้ — เทียบ element ไม่ใช่ testid)
    expect(
      await control.evaluate((el, labelEl) => (el as HTMLInputElement).labels?.[0] === labelEl, await label.elementHandle()),
      `${id}: labels[0] = ${id}-label ของ scope นี้`
    ).toBe(true)
    await expect(control, id).toHaveAccessibleName(await labelText(label))
    await expect(control, `${id}: ไม่มี placeholder`).not.toHaveAttribute("placeholder")
    if (required) {
      await expect(control, id).toHaveAttribute("required", "")
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveText("*")
    } else {
      await expect(control, id).not.toHaveAttribute("required")
      await expect(label.locator('[aria-hidden="true"]'), id).toHaveCount(0)
    }
  }
}

/** label ที่เลื่อนด้วย translate (floating label เดิม) ต้องไม่มีเหลือในขอบเขต */
const translatedLabels = (scope: Locator) =>
  scope.locator("label").evaluateAll((labels) =>
    labels.filter((l) => !["none", ""].includes(getComputedStyle(l).translate)).map((l) => l.outerHTML.slice(0, 80))
  )

const heightOf = (control: Locator) => control.evaluate((el) => getComputedStyle(el).height)

async function expectNoOverflowAt390(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
}

const storeHeaders = (pk: string, customer: Customer) => ({ authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk })

/** order 2 line (variant ต่างกันของ t-shirt) ที่ fulfill + ship แล้ว — ฟอร์มคืนสินค้ามี 2 แถว */
async function shippedTwoLineOrder(request: APIRequestContext) {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const headers = storeHeaders(pk, customer)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const { productId } = await variantOf(request, pk, "t-shirt")
  const { product } = await ok(await request.get(`${BACKEND_URL}/store/products/${productId}?fields=id,*variants`, { headers }), "product")
  const { cart } = await ok(await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, { headers }), "cart")
  const second = product.variants.find((v: { id: string }) => v.id !== cart.items[0].variant_id)
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, { headers, data: { variant_id: second.id, quantity: 1 } }),
    "second line"
  )
  const { payment_collection } = await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } }),
    "payment collection"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      headers,
      data: { provider_id: "pp_system_default" },
    }),
    "payment session"
  )
  const completed = await ok(await request.post(`${BACKEND_URL}/store/carts/${cartId}/complete`, { headers }), "complete")
  expect(completed.type, JSON.stringify(completed)).toBe("order")
  const orderId: string = completed.order.id
  await fulfillAndShip(request, admin, orderId)
  // เหตุผลการคืนของ Medusa (admin สร้าง) อย่างน้อยหนึ่งรายการ — ไม่งั้นช่องเหตุผลไม่ render
  await ok(
    await request.post(`${BACKEND_URL}/admin/return-reasons`, {
      headers: admin,
      data: { value: `sfui12c-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, label: "ขนาดไม่พอดี" },
    }),
    "return reason"
  )
  // ชุดเหตุผลที่หน้าแสดง = GET /store/return-reasons แบบเดียวกับ listReturnReasons (limit 100, ลำดับของ API)
  const { return_reasons } = await ok(
    await request.get(`${BACKEND_URL}/store/return-reasons?limit=100&fields=id,value,label`, { headers }),
    "return reasons"
  )
  return { pk, customer, orderId, reasons: return_reasons as { id: string; label: string }[] }
}

const RETURN_URL = (orderId: string) => `/${CC}/account/orders/details/${orderId}/return`

test.describe("ฟอร์มคืนสินค้า", () => {
  test("AC-34 (12c): ทุกแถว return-item-quantity/return-item-reason มี label ของตัวเองเหนือช่อง, labels[0] ชี้ถูกแถว, id ไม่ซ้ำ", async ({
    page,
    context,
    request,
    baseURL,
    evidence,
  }) => {
    test.setTimeout(180_000)
    const { customer, orderId } = await shippedTwoLineOrder(request)
    await signInAs(context, baseURL!, customer)
    await page.goto(RETURN_URL(orderId))
    const rows = page.getByTestId("return-item")
    await expect(rows).toHaveCount(2)
    for (const row of await rows.all()) await expectLabelAbove(row, RETURN_ROW)
    const ids = await page.locator('[data-testid="return-item-quantity"], [data-testid="return-item-reason"]').evaluateAll((els) => els.map((e) => e.id))
    expect(ids).toHaveLength(4)
    expect(ids.every(Boolean), "ทุกช่องมี id").toBe(true)
    expect(new Set(ids).size, "id ไม่ซ้ำต่อแถว").toBe(4)
    await expectThai(page, ["return-item-quantity-label", "return-item-reason-label"])
    expect(await heightOf(rows.first().getByTestId("return-item-quantity"))).toBe("36px")
    expect(await translatedLabels(page.getByTestId("return-request-container"))).toEqual([])
    await evidence("01-return-form-1280")
    await expectNoOverflowAt390(page)
  })

  test("AC-34 (12c, กฎ 31a): option ของ return-item-quantity/return-item-reason เท่าเดิม (option ว่างเดิม)", async ({ page, context, request, baseURL }) => {
    test.setTimeout(180_000)
    const { customer, orderId, reasons } = await shippedTwoLineOrder(request)
    await signInAs(context, baseURL!, customer)
    await page.goto(RETURN_URL(orderId))
    const rows = page.getByTestId("return-item")
    await expect(rows).toHaveCount(2)
    for (const row of await rows.all()) {
      // แต่ละ line จำนวน 1 → 0..1 และ option ว่าง disabled "จำนวน" เดิม
      expect(await optionsOf(row.getByTestId("return-item-quantity"))).toEqual([
        ["", "จำนวน", true],
        ["0", "0", false],
        ["1", "1", false],
      ])
      expect(await optionsOf(row.getByTestId("return-item-reason"))).toEqual([
        ["", "เลือกเหตุผล", true],
        ...reasons.map((r): Option => [r.id, r.label, false]),
      ])
    }
  })
})

/** ลูกค้าที่มีที่อยู่ 2 รายการ login แล้ว + กลุ่ม pool ของ t-shirt */
async function groupShopper(request: APIRequestContext, page: Page, baseURL: string) {
  const ctx = await poolGroup(request, { max_units_per_person: 5 })
  const customer = await createCustomer(request, ctx.pk)
  await addAddresses(request, ctx.pk, customer, [
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "1 ถนนสุขุมวิท", city: "กรุงเทพ", postal_code: "10110", phone: "0811111111" },
    { first_name: "สมชาย", last_name: "ใจดี", address_1: "99 ถนนนิมมาน", city: "เชียงใหม่", postal_code: "50200", phone: "0822222222" },
  ])
  await signInAs(page.context(), baseURL, customer)
  const { customer: me } = await ok(
    await request.get(`${BACKEND_URL}/store/customers/me?fields=*addresses`, { headers: storeHeaders(ctx.pk, customer) }),
    "me"
  )
  return { ctx, addresses: me.addresses as Record<string, string | null>[] }
}

/** เพิ่ม variant หนึ่งรายการแล้วกด "เลือกวิธีจัดส่ง" → รอ group-shipping-option */
async function loadShipping(page: Page) {
  await page.getByTestId("group-options").getByTestId("option-button").filter({ hasText: /^S$/ }).click()
  await page.getByTestId("group-add-variant").click()
  await expect(page.getByTestId("group-selection-item")).toHaveCount(1)
  await page.getByTestId("group-shipping-load").click()
  await expect(page.getByTestId("group-shipping-option")).toBeVisible({ timeout: 30_000 })
}

const GROUP_FIELDS: Fields = { "group-quantity": false, "group-address-select": false }

test.describe("group buy join", () => {
  test("AC-34 (12c): group-quantity/group-address-select/group-shipping-option มี label เหนือช่อง", async ({ page, request, baseURL, evidence }) => {
    test.setTimeout(180_000)
    const { ctx } = await groupShopper(request, page, baseURL!)
    await page.goto(`/${CC}/g/${ctx.token}`)
    const join = page.getByTestId("group-join")
    await expectLabelAbove(join, GROUP_FIELDS)
    await loadShipping(page)
    await expectLabelAbove(join, { "group-shipping-option": false })
    await expectThai(page, ["group-quantity-label", "group-address-select-label", "group-shipping-option-label"])
    for (const id of ["group-quantity", "group-address-select", "group-shipping-option"]) {
      expect(await heightOf(join.getByTestId(id)), id).toBe("36px")
    }
    expect(await translatedLabels(join)).toEqual([])
    await evidence("02-group-join-1280")
    await expectNoOverflowAt390(page)
  })

  test("AC-34 (12c, กฎ 31a): option ของ select ใน group join เท่าเดิม — quantity/address ไม่มี option ว่าง, วิธีจัดส่งมีตัวเดียว", async ({
    page,
    request,
    baseURL,
  }) => {
    test.setTimeout(180_000)
    const { ctx, addresses } = await groupShopper(request, page, baseURL!)
    await page.goto(`/${CC}/g/${ctx.token}`)
    expect(await optionsOf(page.getByTestId("group-quantity"))).toEqual(PDP_QUANTITY_OPTIONS.map((q): Option => [String(q), String(q), false]))
    // ข้อความ = addressLabel ของ group-join.tsx (ชื่อ นามสกุล ที่อยู่ เมือง รหัสไปรษณีย์) — เทียบแบบไม่ขึ้นกับลำดับของ API
    const expected = addresses
      .map((a): Option => [a.id!, [a.first_name, a.last_name, a.address_1, a.city, a.postal_code].filter(Boolean).join(" "), false])
      .sort()
    expect((await optionsOf(page.getByTestId("group-address-select"))).sort()).toEqual(expected)

    await loadShipping(page)
    const shipping = page.getByTestId("group-shipping-option")
    await expect(shipping).toHaveValue("")
    const [first, ...rest] = await optionsOf(shipping)
    expect(first).toEqual(["", "เลือกวิธีจัดส่ง", true])
    expect(rest.length).toBeGreaterThan(0)
    for (const [value, text, disabled] of rest) {
      expect(value, text).not.toBe("")
      expect(disabled, text).toBe(false)
      expect(text, "ชื่อ — ราคา").toMatch(/^.+ — .+$/)
    }
    expect(rest.some(([, text]) => text.startsWith("Standard"))).toBe(true)
  })
})

test("AC-34 (12c): affiliate login และสมัคร — label เหนือช่อง, * ทุกช่อง (บังคับ), ไม่มี placeholder, label รหัสแนะนำคงเดิม", async ({
  page,
  step,
  evidence,
}) => {
  await page.goto(`/${CC}/affiliate/login`)
  const forms = page.locator("form")
  const login = forms.filter({ has: page.getByTestId("affiliate-login-email") })
  const register = forms.filter({ has: page.getByTestId("affiliate-register-email") })

  await step("login", async () => {
    await expectLabelAbove(login, AFFILIATE_LOGIN)
    expect(await heightOf(login.getByTestId("affiliate-login-email"))).toBe("36px")
  })
  await step("สมัคร", async () => {
    await expectLabelAbove(register, AFFILIATE_REGISTER)
    // baseline กฎ 10: ข้อความ label ของรหัสแนะนำคงเดิม
    expect(await labelText(register.getByTestId("affiliate-register-code-label"))).toBe("รหัสแนะนำ (a-z, 0-9, - ยาว 3-32 ตัว)")
    await expect(register.getByTestId("affiliate-register-code")).toHaveAttribute("title", "ใช้ตัวอักษร a-z ตัวเลข และขีด ยาว 3-32 ตัว")
  })
  await expectThai(page, [...Object.keys(AFFILIATE_LOGIN), ...Object.keys(AFFILIATE_REGISTER)].map((id) => `${id}-label`))
  expect(await translatedLabels(page.locator("main"))).toEqual([])
  await evidence("03-affiliate-auth-1280")
  await expectNoOverflowAt390(page)
})
