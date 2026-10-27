import { APIRequestContext } from "@playwright/test"
import crypto from "node:crypto"

import { BACKEND_URL, expect } from "./fixtures"
import { Customer, Headers } from "./medusa"

// EV-5b/EV-7b: เตรียม voucher (product + partner + pool + code) และ order ที่ capture แล้วผ่าน API ของ Medusa

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ Medusa API ใน e2e
export type Json = any

export async function call(
  request: APIRequestContext,
  headers: Headers,
  path: string,
  data?: Record<string, unknown>
): Promise<Json> {
  const res = data
    ? await request.post(`${BACKEND_URL}${path}`, { headers, data })
    : await request.get(`${BACKEND_URL}${path}`, { headers })
  expect(res.status(), `${data ? "POST" : "GET"} ${path}: ${await res.text()}`).toBe(200)
  return res.json()
}

export type Voucher = { variantId: string; handle: string; partnerName: string }

/** voucher variant (ไม่มี shipping profile) + pool + import `count` code (`code,pin,expires_at?`) ผ่าน admin API */
export async function createVoucher(
  request: APIRequestContext,
  admin: Headers,
  count = 2,
  pool: { validity_note?: string; expires_at?: string } = {}
): Promise<Voucher> {
  const tag = `ev-${Date.now()}-${crypto.randomInt(1e6)}`
  const { sales_channels } = await call(request, admin, "/admin/sales-channels?name=Default%20Sales%20Channel")
  const { stock_locations } = await call(request, admin, "/admin/stock-locations?limit=1")
  const { product } = await call(request, admin, "/admin/products", {
    title: `Voucher ${tag}`,
    status: "published",
    sales_channels: [{ id: sales_channels[0].id }],
    options: [{ title: "Value", values: ["500"] }],
    variants: [
      {
        title: "500 THB",
        options: { Value: "500" },
        manage_inventory: true,
        prices: [{ currency_code: "thb", amount: 500 }],
      },
    ],
  })
  const variantId: string = product.variants[0].id
  const { variant } = await call(
    request,
    admin,
    `/admin/products/${product.id}/variants/${variantId}?fields=inventory_items.inventory_item_id`
  )
  await call(request, admin, `/admin/inventory-items/${variant.inventory_items[0].inventory_item_id}/location-levels`, {
    location_id: stock_locations[0].id,
    stocked_quantity: 0,
  })
  const partnerName = `Partner ${tag}`
  const { partner } = await call(request, admin, "/admin/evoucher/partners", { name: partnerName })
  const created = await call(request, admin, "/admin/evoucher/pools", {
    partner_id: partner.id,
    variant_id: variantId,
    name: `Pool ${tag}`,
    how_to_use: "แสดง code ที่แคชเชียร์",
    ...(pool.validity_note ? { validity_note: pool.validity_note } : {}),
  })
  const expires = pool.expires_at ? `,${pool.expires_at}` : ""
  const imported = await request.post(`${BACKEND_URL}/admin/evoucher/pools/${created.pool.id}/import`, {
    headers: admin,
    multipart: {
      file: {
        name: "codes.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          Array.from({ length: count }, (_, i) => `${tag}-${i},${1111 * (i + 1)}${expires}\n`).join("")
        ),
      },
    },
  })
  expect(imported.status(), "import codes").toBe(200)
  return { variantId, handle: product.handle, partnerName }
}

/** cart digital-only (ไม่มีที่อยู่/shipping method, AC-3) → complete → capture โดย admin → payment.captured */
export async function placeCapturedOrder(
  request: APIRequestContext,
  admin: Headers,
  pk: string,
  customer: Customer,
  variantId: string,
  quantity = 2
): Promise<string> {
  const store = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await call(request, store, "/store/regions")
  const { cart } = await call(request, store, "/store/carts", {
    region_id: regions[0].id,
    email: customer.email,
    items: [{ variant_id: variantId, quantity }],
  })
  const { payment_collection } = await call(request, store, "/store/payment-collections", { cart_id: cart.id })
  await call(request, store, `/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    provider_id: "pp_system_default",
  })
  const done = await call(request, store, `/store/carts/${cart.id}/complete`, {})
  expect(done.type, JSON.stringify(done)).toBe("order")
  const orderId: string = done.order.id

  const { order } = await call(request, admin, `/admin/orders/${orderId}?fields=*payment_collections.payments`)
  await call(request, admin, `/admin/payments/${order.payment_collections[0].payments[0].id}/capture`, {})
  return orderId
}

/** EV-4 ส่งมอบแบบ async (subscriber payment.captured) — รอจน code ของ order เป็น delivered ครบ */
export const waitDelivered = (request: APIRequestContext, admin: Headers, orderId: string, count: number) =>
  expect
    .poll(
      async () =>
        (await call(request, admin, `/admin/evoucher/orders/${orderId}/codes`)).codes.map(
          (c: { status: string }) => c.status
        ),
      { timeout: 30_000 }
    )
    .toEqual(Array(count).fill("delivered"))
