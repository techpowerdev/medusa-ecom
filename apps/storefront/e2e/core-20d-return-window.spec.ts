import { APIRequestContext, APIResponse } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { Client } from "pg"

import { returnErrorMessage, returnWindowDaysOf } from "../src/lib/util/return-request"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  cartReadyForPayment,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
  variantOf,
} from "./support/medusa"
import { expectThai } from "./support/thai-text"

// CORE-20d: spec 01 AC-102 / กฎข้อ 66 — storefront ตัดสินสิทธิ์คืนแบบเดียวกับ backend (CORE-20b): ค่าเริ่มต้นของ
// return_window_days เดียวกันทุกหน้า, ช่วงคืนคิดต่อ line, error ไทยเฉพาะ code และฟอร์มคงค่าเมื่อส่งล้ม
// test ที่แก้ metadata ของ region "th" รันแบบ serial และคืนค่าเดิมใน finally (กฎข้อ 60) — ตรวจผลการคืนค่าทุกครั้ง
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-20d" } })
test.describe.configure({ mode: "serial" })

const DAY_MS = 24 * 60 * 60 * 1000
const BACKEND_SRC = path.resolve(__dirname, "../../backend/src")

/** ค่าเริ่มต้นของ backend อ่านจาก source ตรง (AC-102: เทียบกับค่าใน region-store-policies.ts) */
const backendDefaultWindow = () => {
  const source = fs.readFileSync(path.join(BACKEND_SRC, "lib/region-store-policies.ts"), "utf8")
  return Number(source.match(/return_window_days:\s*(\d+)/)![1])
}

/** ข้อความคงที่ของ RETURN_WINDOW_EXPIRED จาก source ของ backend (CORE-20b) */
const backendWindowExpiredMessage = () => {
  const source = fs.readFileSync(path.join(BACKEND_SRC, "api/store/ownership/return-window.ts"), "utf8")
  return source.match(/code:\s*RETURN_WINDOW_EXPIRED,\s*message:\s*"([^"]+)"/)![1]
}

/* eslint-disable @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e */
const json = async (res: APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const storeHeaders = (customer: Customer, pk: string) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

/** fulfill + ship line ที่ระบุ (ทั้งจำนวน) เป็น fulfillment ใหม่ แล้วตั้ง shipped_at ย้อนหลัง `daysAgo` วันใน DB */
async function shipLines(
  request: APIRequestContext,
  admin: Headers,
  orderId: string,
  lines: { id: string; quantity: number }[],
  daysAgo: number
) {
  const { order: before } = await json(
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*fulfillments`, { headers: admin }),
    "order"
  )
  const known = new Set(before.fulfillments.map((f: { id: string }) => f.id))
  const { order } = await json(
    await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments?fields=id,*fulfillments`, {
      headers: admin,
      data: { items: lines },
    }),
    "fulfill"
  )
  const fulfillmentId: string = order.fulfillments.find((f: { id: string }) => !known.has(f.id)).id
  await json(
    await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`, {
      headers: admin,
      data: { items: lines },
    }),
    "ship"
  )
  // admin API ตั้ง shipped_at = ตอนนี้เสมอ → ย้อนวันที่ใน DB ของ e2e (CI ตั้ง DATABASE_URL)
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  try {
    const { rowCount } = await db.query("UPDATE fulfillment SET shipped_at = $1 WHERE id = $2", [
      new Date(Date.now() - daysAgo * DAY_MS),
      fulfillmentId,
    ])
    expect(rowCount, "อัปเดต shipped_at").toBe(1)
  } finally {
    await db.end()
  }
}

async function orderLines(request: APIRequestContext, admin: Headers, orderId: string) {
  const { order } = await json(
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items`, { headers: admin }),
    "order items"
  )
  return order.items as { id: string; quantity: number; variant_id: string }[]
}

/** order 2 line (variant ต่างกันของ t-shirt ใน seed) ของ customer ผ่าน store API + manual payment */
async function placeTwoLineOrder(request: APIRequestContext, pk: string, customer: Customer) {
  const headers = storeHeaders(customer, pk)
  const cartId = await cartReadyForPayment(request, pk, customer)
  const { productId } = await variantOf(request, pk, "t-shirt")
  const { product } = await json(
    await request.get(`${BACKEND_URL}/store/products/${productId}?fields=id,*variants`, { headers }),
    "product"
  )
  const { cart } = await json(await request.get(`${BACKEND_URL}/store/carts/${cartId}?fields=id,*items`, { headers }), "cart")
  const second = product.variants.find((v: { id: string }) => v.id !== cart.items[0].variant_id)
  await json(
    await request.post(`${BACKEND_URL}/store/carts/${cartId}/line-items`, { headers, data: { variant_id: second.id, quantity: 1 } }),
    "second line"
  )
  const { payment_collection } = await json(
    await request.post(`${BACKEND_URL}/store/payment-collections`, { headers, data: { cart_id: cartId } }),
    "payment collection"
  )
  await json(
    await request.post(`${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
      headers,
      data: { provider_id: "pp_system_default" },
    }),
    "payment session"
  )
  const completed = await json(await request.post(`${BACKEND_URL}/store/carts/${cartId}/complete`, { headers }), "complete")
  expect(completed.type, JSON.stringify(completed)).toBe("order")
  return completed.order.id as string
}

async function thRegion(request: APIRequestContext, admin: Headers) {
  const { regions } = await json(
    await request.get(`${BACKEND_URL}/admin/regions?fields=id,metadata,*countries&limit=100`, { headers: admin }),
    "regions"
  )
  return regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === CC)) as {
    id: string
    metadata: Record<string, unknown> | null
  }
}

test("AC-102 (a): region ไม่ตั้ง return_window_days → ปุ่มขอคืน, หน้า /returns และ JSON-LD ใช้ค่าเริ่มต้นของ backend", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(300_000)
  const DEFAULT_DAYS = backendDefaultWindow()
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const region = await thRegion(request, admin)
  const original = { ...(region.metadata ?? {}) }
  // free_returns สลับค่าเพื่อพิสูจน์ว่าหน้า ISR (revalidate 60) render ใหม่หลังแก้ metadata แล้ว ไม่ใช่หน้าเก่าใน cache
  const freeReturns = !(original.free_returns === true || original.free_returns === "true")
  const setMetadata = async (metadata: Record<string, unknown>) =>
    json(await request.post(`${BACKEND_URL}/admin/regions/${region.id}`, { headers: admin, data: { metadata } }), "region metadata")

  try {
    await step("Given region th ไม่มี return_window_days (ลบ key) และ order ที่ส่งแล้ว 10 วัน", async () => {
      // metadata ของ Medusa: ค่า "" = ลบ key
      const { region: updated } = await setMetadata({ ...original, return_window_days: "", free_returns: freeReturns })
      expect(updated.metadata?.return_window_days ?? "").toBe("")
    })
    const customer = await createCustomer(request, pk)
    const order = await placeOrder(request, pk, customer)
    await shipLines(request, admin, order.id, await orderLines(request, admin, order.id), 10)
    await signInAs(context, baseURL!, customer)

    await step("order detail แสดงปุ่มขอคืนสินค้า (10 วัน < ค่าเริ่มต้น)", async () => {
      await page.goto(`/${CC}/account/orders/details/${order.id}`)
      await expect(page.getByTestId("order-return-button")).toBeVisible()
    })

    await step("หน้า /th/returns แสดงจำนวนวันคืน = ค่าเริ่มต้นของ backend (ไม่ใช่ PoliciesUnavailable)", async () => {
      const window = page.getByTestId("returns-policy-window")
      // กฎข้อ 66f: ค่าที่ admin แก้มีผลภายในรอบ ISR (≤ 90 วินาที)
      await expect
        .poll(
          async () => {
            await page.goto(`/${CC}/returns`)
            return window.getAttribute("data-free-returns", { timeout: 5_000 }).catch(() => null)
          },
          { timeout: 120_000, intervals: [1_000, 5_000, 10_000] }
        )
        .toBe(String(freeReturns))
      await expect(window).toHaveAttribute("data-return-window-days", String(DEFAULT_DAYS))
      await expect(window).toContainText(String(DEFAULT_DAYS))
      await expect(page.getByTestId("policy-placeholder")).toHaveCount(0)
      await evidence("01-returns-page-default-window")
    })

    await step("JSON-LD ของหน้าแรกมี MerchantReturnPolicy ของ TH = ค่าเริ่มต้น", async () => {
      const policyOf = async () => {
        await page.goto(`/${CC}`)
        const scripts = await page.locator('script[type="application/ld+json"]').allTextContents()
        const policies = scripts
          .flatMap((text) => [JSON.parse(text)].flat())
          .flatMap((data: { hasMerchantReturnPolicy?: unknown }) => [data.hasMerchantReturnPolicy ?? []].flat())
        return (policies as { applicableCountry?: string; merchantReturnDays?: number; returnFees?: string }[]).find(
          (p) => p.applicableCountry === CC.toUpperCase()
        )
      }
      const expectedFees = freeReturns ? "https://schema.org/FreeReturn" : "https://schema.org/ReturnFeesCustomerResponsibility"
      await expect.poll(async () => (await policyOf())?.returnFees, { timeout: 120_000, intervals: [1_000, 5_000, 10_000] }).toBe(
        expectedFees
      )
      expect((await policyOf())?.merchantReturnDays).toBe(DEFAULT_DAYS)
    })
  } finally {
    // คืนค่าเดิมทุกกรณีและตรวจผล (กฎข้อ 60, 66e)
    const { region: restored } = await setMetadata(original)
    expect(restored.metadata?.return_window_days ?? null).toEqual(original.return_window_days ?? null)
  }
})

test("AC-102 (b): line A ส่งเมื่อ window + 1 วันก่อน, line B ส่งเมื่อวาน → ฟอร์มเลือกได้เฉพาะ B และ backend ตอบ 200", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const window = returnWindowDaysOf((await thRegion(request, admin)).metadata)
  const customer = await createCustomer(request, pk)
  const orderId = await placeTwoLineOrder(request, pk, customer)
  const [lineA, lineB] = await orderLines(request, admin, orderId)
  await shipLines(request, admin, orderId, [{ id: lineA.id, quantity: lineA.quantity }], window + 1)
  await shipLines(request, admin, orderId, [{ id: lineB.id, quantity: lineB.quantity }], 1)
  await signInAs(context, baseURL!, customer)

  await step("order detail มีปุ่ม (มี line ที่คืนได้ ≥ 1) และหน้าขอคืนมีเฉพาะ line B", async () => {
    await page.goto(`/${CC}/account/orders/details/${orderId}`)
    await page.getByTestId("order-return-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders/details/${orderId}/return$`))
    const items = page.getByTestId("return-item")
    await expect(items).toHaveCount(1)
    await expect(items.first()).toHaveAttribute("data-line-id", lineB.id)
    await evidence("02-return-form-line-b-only")
  })

  await step("backend ปฏิเสธ line A ด้วย RETURN_WINDOW_EXPIRED (ตัดสินแบบเดียวกัน)", async () => {
    const headers = storeHeaders(customer, pk)
    const { order } = await json(await request.get(`${BACKEND_URL}/store/orders/${orderId}?fields=id,+cart.id`, { headers }), "store order")
    const { shipping_options } = await json(
      await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${order.cart.id}&is_return=true`, { headers }),
      "return options"
    )
    const res = await request.post(`${BACKEND_URL}/store/returns`, {
      headers,
      data: { order_id: orderId, items: [{ id: lineA.id, quantity: 1 }], return_shipping: { option_id: shipping_options[0].id } },
    })
    expect(res.status()).toBe(400)
    expect(await res.json()).toMatchObject({ code: "RETURN_WINDOW_EXPIRED" })
  })

  await step("ส่งคำขอคืน line B ผ่านฟอร์ม → สำเร็จ (backend 200) และ return มีเฉพาะ line B", async () => {
    const response = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined
    )
    await page.getByTestId("return-item").first().getByTestId("return-item-quantity").selectOption("1")
    await page.getByTestId("return-submit-button").click()
    expect((await response).status()).toBe(200)
    await expect(page.getByTestId("order-return-success")).toBeVisible({ timeout: 30_000 })
    const { order } = await json(
      await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items,*items.detail`, { headers: admin }),
      "order after return"
    )
    const requested = Object.fromEntries(
      order.items.map((i: { id: string; detail: { return_requested_quantity: number } }) => [i.id, i.detail.return_requested_quantity])
    )
    expect(requested).toEqual({ [lineA.id]: 0, [lineB.id]: 1 })
  })
})

test("AC-102 (c, e): backend ตอบ 400 RETURN_WINDOW_EXPIRED → ข้อความไทยเฉพาะ code และฟอร์มคงจำนวน/เหตุผลที่เลือก", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(180_000)
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer, { quantity: 2 })
  await shipLines(request, admin, order.id, await orderLines(request, admin, order.id), 1)
  await signInAs(context, baseURL!, customer)

  const reasonRes = await request.post(`${BACKEND_URL}/admin/return-reasons`, {
    headers: admin,
    data: { value: `core20d-${Date.now()}`, label: "สินค้าชำรุด" },
  })
  const reasonId: string = (await json(reasonRes, "return reason")).return_reason.id
  const expected = returnErrorMessage(
    Object.assign(new Error(backendWindowExpiredMessage()), { status: 400 }),
    "ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
  )

  try {
    await step("route mock: ผลของ server action = backend ตอบ 400 RETURN_WINDOW_EXPIRED", async () => {
      // POST /store/returns ยิงจาก Next server จึง mock จาก browser ไม่ได้ (แบบ AC-100) — ดัก server action ของหน้า return:
      // ส่งต่อด้วย order id ที่ไม่มีจริง (action ล้มก่อนถึง backend และคืนค่าที่เลือกตามจริง) แล้วแทนข้อความ error
      // ด้วยข้อความที่ storefront map จากข้อความคงที่ของ backend (unit `return-request-action.test.ts` ตรวจ FetchError 400 จริง)
      await page.route(
        (url) => url.pathname.endsWith(`/account/orders/details/${order.id}/return`),
        async (route) => {
          const req = route.request()
          // เฉพาะ action ส่งคำขอคืน (ฟอร์มมี order_id) — หน้าเดียวกันมี action อื่น เช่น retrieveCart
          const postData = req.postDataBuffer()?.toString("utf8") ?? ""
          if (req.method() !== "POST" || !req.headers()["next-action"] || !postData.includes("order_id")) {
            return route.fallback()
          }
          const response = await route.fetch({ postData: postData.replaceAll(order.id, "order_core20d_missing") })
          const body = await response.text()
          expect(body).toContain("ไม่พบคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง")
          return route.fulfill({ response, body: body.replace("ไม่พบคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง", expected) })
        }
      )
    })

    await step("เลือกจำนวน 2 + เหตุผล แล้วส่ง → เห็นข้อความไทยของ RETURN_WINDOW_EXPIRED และค่าที่เลือกยังอยู่", async () => {
      await page.goto(`/${CC}/account/orders/details/${order.id}/return`)
      const item = page.getByTestId("return-item").first()
      await item.getByTestId("return-item-quantity").selectOption("2")
      await item.getByTestId("return-item-reason").selectOption(reasonId)
      await page.getByTestId("return-submit-button").click()
      const error = page.getByTestId("return-error")
      await expect(error).toHaveText(expected)
      await expectThai(page, ["return-error"])
      await expect(item.getByTestId("return-item-quantity")).toHaveValue("2")
      await expect(item.getByTestId("return-item-reason")).toHaveValue(reasonId)
      await expect(page.getByTestId("return-submit-button")).toBeEnabled()
      await evidence("03-return-error-keeps-values")
    })
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" })
    const deleted = await request.delete(`${BACKEND_URL}/admin/return-reasons/${reasonId}`, { headers: admin })
    expect(deleted.ok(), `ลบ return reason: ${await deleted.text()}`).toBe(true)
  }
})
