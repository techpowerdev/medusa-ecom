import { APIRequestContext, APIResponse } from "@playwright/test"

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
import { THAI } from "./support/thai-text"

// CORE-22: spec 01 กฎข้อ 46–48, AC-82, AC-83, AC-84 (defect ของ starter จาก qa #92)
// หา element ด้วย data-testid เท่านั้น ตรวจความเป็นไทยด้วย regex อักษรไทย
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-22" } })

const LOGIN_TITLE = "เข้าสู่ระบบ"

/** วาง order ผ่าน store API ด้วย token ของ customer (manual payment ของ seed) คืน id + display_id */
async function placeOrder(
  request: APIRequestContext,
  pk: string,
  customer: Customer
): Promise<{ id: string; displayId: number }> {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
  const ok = async (res: APIResponse, what: string): Promise<any> => {
    expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
    return res.json()
  }

  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) =>
    r.countries.some((c) => c.iso_2 === CC)
  )
  const { variantId } = await variantOf(request, pk, "t-shirt")

  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity: 1 },
    }),
    "add line item"
  )
  const address = {
    first_name: "Somchai",
    last_name: "Jaidee",
    address_1: "1 Sukhumvit Rd",
    city: "Bangkok",
    postal_code: "10110",
    country_code: CC,
  }
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}`, {
      headers,
      data: { email: customer.email, shipping_address: address, billing_address: address },
    }),
    "update cart"
  )
  const { shipping_options } = await ok(
    await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cart.id}`, { headers }),
    "shipping options"
  )
  const standard = shipping_options.find((o: { name: string }) => o.name === "Standard")
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/shipping-methods`, {
      headers,
      data: { option_id: standard.id },
    }),
    "shipping method"
  )
  const { payment_collection } = await ok(
    await request.post(`${BACKEND_URL}/store/payment-collections`, {
      headers,
      data: { cart_id: cart.id },
    }),
    "payment collection"
  )
  await ok(
    await request.post(
      `${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`,
      { headers, data: { provider_id: "pp_system_default" } }
    ),
    "payment session"
  )
  const completed = await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/complete`, { headers }),
    "complete cart"
  )
  expect(completed.type, JSON.stringify(completed)).toBe("order")
  return { id: completed.order.id, displayId: completed.order.display_id }
}

test("AC-82: title ของหน้า account ที่ล็อกอินแล้วตรงหน้า และหน้า login ยังเป็น เข้าสู่ระบบ", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(120_000)
  const pk = await publishableKey(request, await adminHeaders(request))

  await step("ไม่ล็อกอิน: /account เป็นหน้า login", async () => {
    await page.goto(`/${CC}/account`)
    await expect(page.getByTestId("login-page")).toBeVisible()
    await expect(page).toHaveTitle(new RegExp(LOGIN_TITLE))
  })

  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer)
  await signInAs(context, baseURL!, customer)

  const pages = [
    { path: `/${CC}/account`, testId: "overview-stats" },
    { path: `/${CC}/account/profile`, testId: "profile-page-wrapper" },
    { path: `/${CC}/account/addresses`, testId: "addresses-page-wrapper" },
    { path: `/${CC}/account/orders`, testId: "orders-page-wrapper" },
    { path: `/${CC}/account/orders/details/${order.id}`, testId: "order-details-container" },
  ]
  const titles: string[] = []

  for (const { path, testId } of pages) {
    await step(`ล็อกอิน: title ของ ${path}`, async () => {
      await page.goto(path)
      await expect(page.getByTestId(testId)).toBeVisible()
      // title อาจถูก stream มาหลัง body (Next 16) — รอจนไม่ใช่ title ของหน้า login
      await expect(page).not.toHaveTitle(new RegExp(LOGIN_TITLE))
      const title = await page.title()
      expect(title, path).toMatch(THAI)
      titles.push(title)
    })
  }

  await step("title ต่างกันทั้ง 5 และหน้า order detail มี display_id", async () => {
    expect(new Set(titles).size, titles.join(" | ")).toBe(pages.length)
    expect(titles[4]).toContain(String(order.displayId))
    await evidence("01-order-detail-title")
  })
})

test("AC-83, AC-84: profile เบอร์ว่างไม่แสดง null และกด แก้ไข เบอร์โทรไม่โดน editor อีเมลที่ปิดอยู่", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const pk = await publishableKey(request, await adminHeaders(request))
  await signInAs(context, baseURL!, await createCustomer(request, pk))

  const editors = [
    "account-name-editor",
    "account-email-editor",
    "account-phone-editor",
    "account-billing-address-editor",
  ]
  const phone = page.getByTestId("account-phone-editor")
  const email = page.getByTestId("account-email-editor")

  await step("AC-83: บล็อกเบอร์โทรไม่มี null/undefined", async () => {
    await page.goto(`/${CC}/account/profile`)
    await expect(phone).toBeVisible()
    const text = (await phone.getByTestId("current-info").textContent()) ?? ""
    expect(text).not.toMatch(/null|undefined/)
    expect(text).toMatch(THAI)
  })

  await step("AC-84: คลิก แก้ไข เบอร์โทร → editor เบอร์เปิด, editor อีเมลปิด, ไม่มี request update", async () => {
    const actions: string[] = []
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) actions.push(req.url())
    })
    // starter: panel ที่ปิดของ editor อีเมลยัง overflow-visible → ปุ่มบันทึกที่มองไม่เห็นบัง "แก้ไข" ของเบอร์โทร
    await phone.getByTestId("edit-button").click({ timeout: 10_000 })
    await expect(phone.getByTestId("edit-button")).toHaveAttribute("data-active", "true")
    await expect(phone.getByTestId("edit-panel")).toHaveAttribute("data-open", "true")
    await expect(phone.getByTestId("phone-input")).toBeVisible()
    await expect(email.getByTestId("edit-panel")).toHaveAttribute("data-open", "false")
    expect(actions).toEqual([])
    await evidence("02-profile-phone-editor-open")
  })
  await step("AC-84: editor ที่ปิดไม่รับ pointer (pointer-events none หรือ inert)", async () => {
    // หลังคลิก เหลือ editor เบอร์โทรเปิดตัวเดียว ตัวอื่นต้องปิดและไม่รับ pointer
    for (const id of editors.filter((e) => e !== "account-phone-editor")) {
      const panel = page.getByTestId(id).getByTestId("edit-panel")
      await expect(panel, id).toHaveAttribute("data-open", "false")
      const blocked = await panel.evaluate(
        (el) => getComputedStyle(el).pointerEvents === "none" || (el as HTMLElement).inert
      )
      expect(blocked, id).toBe(true)
    }
  })

})
