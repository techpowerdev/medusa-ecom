import { APIRequestContext } from "@playwright/test"

import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Customer,
  Headers,
  adminHeaders,
  createCustomer,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-20c: spec 01 AC-96 / กฎข้อ 60 — จำนวนที่คืนได้นับ shipped_quantity, ช่วงคืนจาก region ของ order (ไม่ใช่ countryCode
// ใน URL) และสถานะใหม่เห็นทันทีหลังส่ง return; test ที่แก้ metadata ใช้ region แยกของ test เท่านั้น (ไม่แตะ region "th" ที่ใช้ร่วม)
test.use({ evidenceTarget: { feature: "core", taskId: "CORE-20c" } })

/* eslint-disable @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e */
const json = async (res: import("@playwright/test").APIResponse, what: string): Promise<any> => {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
  return res.json()
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** fulfill line ทั้งหมดของ order ตามจำนวนที่ระบุ แล้ว ship เมื่อ `ship` = true */
async function fulfill(request: APIRequestContext, admin: Headers, orderId: string, quantity: number, ship: boolean) {
  const { order } = await json(
    await request.get(`${BACKEND_URL}/admin/orders/${orderId}?fields=id,*items,*fulfillments`, { headers: admin }),
    "order"
  )
  const items = order.items.map((i: { id: string }) => ({ id: i.id, quantity }))
  const before = new Set(order.fulfillments.map((f: { id: string }) => f.id))
  const { order: fulfilled } = await json(
    await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments?fields=id,*fulfillments`, {
      headers: admin,
      data: { items },
    }),
    "fulfill"
  )
  const created = fulfilled.fulfillments.find((f: { id: string }) => !before.has(f.id))
  if (ship) {
    await json(
      await request.post(`${BACKEND_URL}/admin/orders/${orderId}/fulfillments/${created.id}/shipments`, {
        headers: admin,
        data: { items },
      }),
      "ship"
    )
  }
}

const storeHeaders = (customer: Customer, pk: string) => ({
  authorization: `Bearer ${customer.token}`,
  "x-publishable-api-key": pk,
})

test("AC-96: line qty 3 fulfilled 3 shipped 2 และขอคืนไปแล้ว 1 → เลือกคืนได้สูงสุด 1; ส่งแล้วหน้า order detail เห็นสถานะใหม่ทันที", async ({
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
  const order = await placeOrder(request, pk, customer, { quantity: 3 })
  await fulfill(request, admin, order.id, 2, true)
  await fulfill(request, admin, order.id, 1, false)

  await step("ขอคืน 1 ชิ้นผ่าน POST /store/returns (return requested)", async () => {
    const headers = storeHeaders(customer, pk)
    const { order: storeOrder } = await json(
      await request.get(`${BACKEND_URL}/store/orders/${order.id}?fields=id,+cart.id,*items`, { headers }),
      "store order"
    )
    const { shipping_options } = await json(
      await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${storeOrder.cart.id}&is_return=true`, { headers }),
      "return options"
    )
    const item = storeOrder.items[0]
    expect(item.detail).toMatchObject({ fulfilled_quantity: 3, shipped_quantity: 2 })
    await json(
      await request.post(`${BACKEND_URL}/store/returns`, {
        headers,
        data: {
          order_id: order.id,
          items: [{ id: item.id, quantity: 1 }],
          return_shipping: { option_id: shipping_options[0].id },
        },
      }),
      "request return"
    )
  })

  await signInAs(context, baseURL!, customer)

  await step("หน้าขอคืน: จำนวนสูงสุดที่เลือกได้ = shipped 2 − requested 1 = 1", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await page.getByTestId("order-return-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders/details/${order.id}/return$`))
    const quantity = page.getByTestId("return-item").first().getByTestId("return-item-quantity")
    // ไม่นับ placeholder (option disabled value="") ของ NativeSelect
    await expect(quantity.locator('option:not([value=""])')).toHaveText(["0", "1"])
    await quantity.selectOption("1")
    await evidence("01-return-max-shipped")
  })

  await step("ส่งคำขอ → order detail ไม่มีปุ่มขอคืนทันที (ส่งแล้ว 2 ขอคืนครบ 2)", async () => {
    await page.getByTestId("return-submit-button").click()
    await expect(page.getByTestId("order-return-success")).toBeVisible({ timeout: 30_000 })
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-details-container")).toBeVisible()
    await expect(page.getByTestId("order-return-button")).toHaveCount(0)
  })
})

// region แยกของ test: ประเทศที่ยังไม่มี region + service zone/option "Standard" ของตัวเอง — ลบทิ้งใน afterAll
const CANDIDATE_COUNTRIES = ["la", "kh", "mm", "bn", "mn", "np"]
let fixture: { regionId: string; country: string; fulfillmentSetId: string; zoneId: string; optionId: string } | null = null

test.afterAll(async ({ request }) => {
  if (!fixture) return
  const admin = await adminHeaders(request)
  await request.delete(`${BACKEND_URL}/admin/shipping-options/${fixture.optionId}`, { headers: admin })
  await request.delete(`${BACKEND_URL}/admin/fulfillment-sets/${fixture.fulfillmentSetId}/service-zones/${fixture.zoneId}`, {
    headers: admin,
  })
  await request.delete(`${BACKEND_URL}/admin/regions/${fixture.regionId}`, { headers: admin })
  fixture = null
})

async function createTestRegion(request: APIRequestContext, admin: Headers, returnWindowDays: number) {
  const { regions } = await json(await request.get(`${BACKEND_URL}/admin/regions?fields=id,*countries&limit=100`, { headers: admin }), "regions")
  const used = new Set(regions.flatMap((r: { countries: { iso_2: string }[] }) => r.countries.map((c) => c.iso_2)))
  const country = CANDIDATE_COUNTRIES.find((c) => !used.has(c))
  expect(country, "ประเทศว่างสำหรับ region ของ test").toBeTruthy()

  const { stock_locations } = await json(
    await request.get(`${BACKEND_URL}/admin/stock-locations?fields=id,*fulfillment_sets,*fulfillment_sets.service_zones,*fulfillment_sets.service_zones.geo_zones`, {
      headers: admin,
    }),
    "stock locations"
  )
  /* eslint-disable @typescript-eslint/no-explicit-any -- payload ของ admin API */
  const fulfillmentSet = stock_locations
    .flatMap((l: any) => l.fulfillment_sets ?? [])
    .find((s: any) => s.service_zones.some((z: any) => z.geo_zones.some((g: any) => g.country_code === CC)))
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const { shipping_profiles } = await json(
    await request.get(`${BACKEND_URL}/admin/shipping-profiles?type=default`, { headers: admin }),
    "shipping profiles"
  )

  const { region } = await json(
    await request.post(`${BACKEND_URL}/admin/regions`, {
      headers: admin,
      data: {
        name: `CORE-20c e2e ${country}`,
        currency_code: "thb",
        countries: [country],
        payment_providers: ["pp_system_default"],
        metadata: { return_window_days: returnWindowDays },
      },
    }),
    "create region"
  )
  fixture = { regionId: region.id, country: country!, fulfillmentSetId: fulfillmentSet.id, zoneId: "", optionId: "" }

  const zoneName = `CORE-20c e2e ${country} ${Date.now()}`
  const { fulfillment_set } = await json(
    await request.post(`${BACKEND_URL}/admin/fulfillment-sets/${fulfillmentSet.id}/service-zones`, {
      headers: admin,
      data: { name: zoneName, geo_zones: [{ type: "country", country_code: country }] },
    }),
    "create service zone"
  )
  fixture.zoneId = fulfillment_set.service_zones.find((z: { name: string }) => z.name === zoneName).id

  const { shipping_option } = await json(
    await request.post(`${BACKEND_URL}/admin/shipping-options`, {
      headers: admin,
      data: {
        name: "Standard",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fixture.zoneId,
        shipping_profile_id: shipping_profiles[0].id,
        type: { label: "Standard", description: "CORE-20c e2e", code: "core20c-e2e-standard" },
        prices: [{ currency_code: "thb", amount: 10 }],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    }),
    "create shipping option"
  )
  fixture.optionId = shipping_option.id

  const setReturnWindow = async (metadata: Record<string, unknown>) =>
    json(await request.post(`${BACKEND_URL}/admin/regions/${region.id}`, { headers: admin, data: { metadata } }), "region metadata")
  return { country: country!, setReturnWindow }
}

test("AC-96: URL /th แต่ order อยู่ region อื่นที่ return_window_days=7 → ปุ่มคิดจาก region ของ order; admin แก้ค่าแล้วมีผลทันที", async ({
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
  const { country, setReturnWindow } = await createTestRegion(request, admin, 7)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer, { country })
  await fulfill(request, admin, order.id, 1, true)
  await signInAs(context, baseURL!, customer)

  await step("region ของ order (7 วัน) ส่งวันนี้ → มีปุ่มขอคืนบน URL /th", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-return-button")).toBeVisible()
    await evidence("02-return-button-order-region")
  })

  await step("region ของ order ไม่ตั้ง return_window_days → ใช้ค่าเริ่มต้นเดียวกับ backend (30 วัน) ยังมีปุ่ม", async () => {
    await setReturnWindow({ return_window_days: "" })
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-return-button")).toBeVisible()
  })

  await step("admin ตั้ง return_window_days=0 ที่ region ของ order (region th ยังเป็นค่าเดิม) → ไม่มีปุ่ม และหน้า return ไม่ให้ขอคืน", async () => {
    await setReturnWindow({ return_window_days: 0 })
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await expect(page.getByTestId("order-details-container")).toBeVisible()
    await expect(page.getByTestId("order-return-button")).toHaveCount(0)
    await page.goto(`/${CC}/account/orders/details/${order.id}/return`)
    await expect(page.getByTestId("return-not-available")).toBeVisible()
  })
})
