import crypto from "node:crypto"

import { APIRequestContext } from "@playwright/test"

import { ADMIN_UI_OPTIONS, loginAdmin } from "./support/admin"
import { deleteAllThenExpectOk } from "./support/cleanup"
import { BACKEND_URL, expect, test } from "./support/fixtures"
import {
  STOREFRONT_COUNTRY as CC,
  Headers,
  adminHeaders,
  createCustomer,
  fulfillAndShip,
  placeOrder,
  publishableKey,
  signInAs,
} from "./support/medusa"

// CORE-55 (spec 01 กฎข้อ 113, AC-154, ADR-022): ลูกค้าขอคืนจากหน้าเว็บ แล้วแอดมินกด Receive items ในหน้า order ของ Medusa
// ต้องรับของได้จริง (Medusa 2.22.1 ทิ้ง return.location_id เป็น null → confirm ตอบ 500) — หน้า order เป็นของ Medusa ใส่ data-testid
// ไม่ได้ จึงหา element ของ admin ด้วย attribute (แบบ loginAdmin) ไม่ match ข้อความ; ฝั่ง storefront ใช้ data-testid
test.use({
  ...ADMIN_UI_OPTIONS,
  viewport: { width: 1280, height: 800 },
  evidenceTarget: { feature: "core", taskId: "CORE-55" },
})

const RETURN_OPTION_TYPE_CODE = "standard-return"
const STOCK = 5

let admin: Headers
let productId: string | undefined
let variantId: string
let inventoryItemId: string
let locationId: string

async function json(request: APIRequestContext, path: string) {
  const res = await request.get(`${BACKEND_URL}${path}`, { headers: admin })
  expect(res.ok(), `${path}: ${res.status()}`).toBe(true)
  return res.json()
}

/** stocked/reserved ของ inventory level ของสินค้าของ test ที่ location ของ return option */
async function levelAtReturnLocation(request: APIRequestContext) {
  const { inventory_levels } = await json(request, `/admin/inventory-items/${inventoryItemId}/location-levels`)
  const level = inventory_levels.find((l: { location_id: string }) => l.location_id === locationId)
  return { stocked: Number(level.stocked_quantity), reserved: Number(level.reserved_quantity) }
}

test.beforeAll(async ({ request }) => {
  admin = await adminHeaders(request)
  const { shipping_options } = await json(
    request,
    "/admin/shipping-options?fields=id,*type,service_zone.fulfillment_set.location.id&limit=100"
  )
  const option = shipping_options.find((o: { type?: { code?: string } }) => o.type?.code === RETURN_OPTION_TYPE_CODE)
  locationId = option.service_zone.fulfillment_set.location.id
  expect(locationId, "location ของ return option").toBeTruthy()

  // สินค้าของ test เอง manage_inventory=true พร้อม level ที่ location ของ return option (ไม่ใช้ stock ของสินค้า seed)
  const { sales_channels } = await json(request, "/admin/sales-channels?limit=1")
  const { shipping_profiles } = await json(request, "/admin/shipping-profiles?type=default")
  const handle = `e2e-core55-${Date.now()}${crypto.randomInt(1e6)}`
  const created = await request.post(`${BACKEND_URL}/admin/products?fields=id,*variants,*variants.inventory_items`, {
    headers: admin,
    data: {
      title: "เสื้อยืดทดสอบคืนสินค้า",
      handle,
      status: "published",
      shipping_profile_id: shipping_profiles[0].id,
      sales_channels: [{ id: sales_channels[0].id }],
      options: [{ title: "Size", values: ["M"] }],
      variants: [
        {
          title: "M",
          sku: `${handle}-M`.toUpperCase(),
          options: { Size: "M" },
          manage_inventory: true,
          prices: [{ currency_code: "thb", amount: 590 }],
        },
      ],
    },
  })
  expect(created.ok(), `create product: ${await created.text()}`).toBe(true)
  const { product } = await created.json()
  productId = product.id
  variantId = product.variants[0].id
  inventoryItemId = product.variants[0].inventory_items[0].inventory_item_id
  const level = await request.post(`${BACKEND_URL}/admin/inventory-items/${inventoryItemId}/location-levels`, {
    headers: admin,
    data: { location_id: locationId, stocked_quantity: STOCK },
  })
  expect(level.ok(), `location level: ${await level.text()}`).toBe(true)
})

test.afterAll(async ({ request }) => {
  await deleteAllThenExpectOk(request, admin, [productId && `/admin/products/${productId}`])
})

test("AC-154: ลูกค้าขอคืนจากหน้าเว็บ → แอดมินกด Receive items ในหน้า order ได้ → return received และ stock +1", async ({
  page,
  context,
  request,
  baseURL,
  step,
  evidence,
}) => {
  test.setTimeout(240_000)
  const pk = await publishableKey(request, admin)
  const customer = await createCustomer(request, pk)
  const order = await placeOrder(request, pk, customer, { variant: variantId })
  await fulfillAndShip(request, admin, order.id)
  await signInAs(context, baseURL!, customer)

  await step("ลูกค้าขอคืน 1 ชิ้นจากหน้า order → เห็นข้อความสำเร็จ", async () => {
    await page.goto(`/${CC}/account/orders/details/${order.id}`)
    await page.getByTestId("order-return-button").click()
    await expect(page).toHaveURL(new RegExp(`/${CC}/account/orders/details/${order.id}/return$`))
    await page.getByTestId("return-item").first().getByTestId("return-item-quantity").selectOption("1")
    await page.getByTestId("return-submit-button").click()
    await expect(page.getByTestId("order-return-success")).toBeVisible()
    await evidence("01-store-return-success")
  })

  const { returns } = await json(request, `/admin/returns?order_id=${order.id}&fields=id,status,location_id`)
  expect(returns).toHaveLength(1)
  const returnId: string = returns[0].id
  expect(returns[0]).toEqual(expect.objectContaining({ status: "requested", location_id: locationId }))
  const before = await levelAtReturnLocation(request)
  const receiveLink = page.locator(`a[href$="/orders/${order.id}/returns/${returnId}/receive"]`)
  const isPost = (path: RegExp) => (res: { request(): { method(): string }; url(): string }) =>
    res.request().method() === "POST" && path.test(new URL(res.url()).pathname)
  const returnPath = `/admin/returns/${returnId}`

  await step("แอดมินเปิดหน้า order → กดลิงก์ Receive items → กรอกจำนวนที่รับ 1 → ยืนยัน → POST /receive/confirm 200", async () => {
    await loginAdmin(page)
    await page.goto(`${BACKEND_URL}/app/orders/${order.id}`)
    await expect(receiveLink).toBeVisible()
    await evidence("02-admin-order-receive-link")
    // drawer ของ Medusa (dashboard 2.22.1) เริ่มรับของ (POST /receive) แล้วเพิ่ม item ของ return ทั้งหมด (POST /receive-items)
    // เองตอนเปิด — ตั้ง waitForResponse ก่อนคลิก และรอให้ช่องจำนวนแสดงค่าจาก preview ก่อนกรอก (กรอกก่อนนั้น = กดซ้อน
    // ตอน action ยังไม่มี → receive-items ซ้ำได้ 400 ซึ่งผู้ใช้จริงไม่ทำ); กรอก 1 แล้ว blur ด้วยค่าเดิมไม่ยิง request ใหม่
    const begun = page.waitForResponse(isPost(new RegExp(`^${returnPath}/receive$`)))
    const added = page.waitForResponse(isPost(new RegExp(`^${returnPath}/receive-items$`)))
    await receiveLink.click()
    expect((await begun).status(), "POST /receive").toBe(200)
    expect((await added).status(), "POST /receive-items").toBe(200)
    const quantity = page.locator('input[name="items.0.quantity"]')
    await expect(quantity).toHaveValue("1")
    await quantity.fill("1")
    await quantity.blur()
    await expect(quantity).toHaveValue("1")
    await evidence("03-admin-receive-form")
    const confirmed = page.waitForResponse(isPost(new RegExp(`^${returnPath}/receive/confirm$`)))
    await page.locator('[role="dialog"] button[type="submit"]').click()
    const response = await confirmed
    expect(response.status(), `POST /receive/confirm: ${await response.text()}`).toBe(200)
  })

  await step("return received, received_quantity 1, stock +1 และลิงก์ Receive items หายจากหน้า order", async () => {
    const { return: received } = await json(request, `${returnPath}?fields=id,status,*items`)
    expect(received.status).toBe("received")
    expect(received.items.map((i: { received_quantity: number }) => Number(i.received_quantity))).toEqual([1])
    expect(await levelAtReturnLocation(request)).toEqual({ stocked: before.stocked + 1, reserved: before.reserved })
    await expect(page).toHaveURL(new RegExp(`/app/orders/${order.id}$`))
    await expect(receiveLink).toHaveCount(0)
    await evidence("04-admin-order-received")
  })
})
