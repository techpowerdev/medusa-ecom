import { APIRequestContext, APIResponse, BrowserContext, expect } from "@playwright/test"
import crypto from "node:crypto"

import { BACKEND_URL } from "./fixtures"

// CORE-6: เตรียมข้อมูล/ตรวจผลผ่าน API ของ Medusa (admin + store) ให้ e2e
// credential ของ admin มาจาก env เท่านั้น (ค่าเดียวกับที่ `pnpm --filter backend seed` ใช้สร้าง admin)

export type Headers = Record<string, string>

const env = (...keys: string[]) => {
  for (const key of keys) {
    if (process.env[key]) return process.env[key] as string
  }
  throw new Error(`ต้องตั้ง env ${keys.join(" หรือ ")} สำหรับ e2e`)
}

export const STOREFRONT_COUNTRY = "th"

export async function adminHeaders(request: APIRequestContext): Promise<Headers> {
  const res = await request.post(`${BACKEND_URL}/auth/user/emailpass`, {
    data: {
      email: env("E2E_ADMIN_EMAIL", "SEED_ADMIN_EMAIL"),
      password: env("E2E_ADMIN_PASSWORD", "SEED_ADMIN_PASSWORD"),
    },
  })
  expect(res.status(), "admin login").toBe(200)
  return { authorization: `Bearer ${(await res.json()).token}` }
}

export async function publishableKey(request: APIRequestContext, admin: Headers): Promise<string> {
  if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  }
  const res = await request.get(`${BACKEND_URL}/admin/api-keys?type=publishable&revoked_at=null`, {
    headers: admin,
  })
  return (await res.json()).api_keys[0].token
}

export type Customer = { email: string; password: string; token: string }

/** สมัคร customer ใหม่ผ่าน auth route ของ Medusa (email ไม่ซ้ำต่อการรัน) */
export async function createCustomer(request: APIRequestContext, pk: string): Promise<Customer> {
  const email = `e2e-core6-${Date.now()}-${crypto.randomInt(1e6)}@example.com`
  const password = crypto.randomBytes(12).toString("hex")
  const reg = await request.post(`${BACKEND_URL}/auth/customer/emailpass/register`, {
    data: { email, password },
  })
  expect(reg.status(), "customer register").toBe(200)
  const created = await request.post(`${BACKEND_URL}/store/customers`, {
    headers: { authorization: `Bearer ${(await reg.json()).token}`, "x-publishable-api-key": pk },
    data: { email, first_name: "Somchai", last_name: "Jaidee" },
  })
  expect(created.status(), "create customer").toBe(200)
  const login = await request.post(`${BACKEND_URL}/auth/customer/emailpass`, {
    data: { email, password },
  })
  return { email, password, token: (await login.json()).token }
}

/** ล็อกอินแบบเดียวกับ storefront: cookie `_medusa_jwt` (httpOnly) ที่ server action อ่าน */
export async function signInAs(context: BrowserContext, baseURL: string, customer: Customer) {
  await context.addCookies([{ name: "_medusa_jwt", value: customer.token, url: baseURL }])
}

export async function variantOf(
  request: APIRequestContext,
  pk: string,
  handle: string
): Promise<{ productId: string; variantId: string }> {
  const res = await request.get(`${BACKEND_URL}/store/products?handle=${handle}&fields=id,*variants`, {
    headers: { "x-publishable-api-key": pk },
  })
  const [product] = (await res.json()).products
  return { productId: product.id, variantId: product.variants[0].id }
}

/** id ของ shipping option ตามชื่อใน seed สำหรับ cart ปัจจุบันของ browser (cookie `_medusa_cart_id`) */
export async function shippingOptionId(
  request: APIRequestContext,
  context: BrowserContext,
  pk: string,
  customer: Customer,
  name: string
): Promise<string> {
  const cartId = (await context.cookies()).find((c) => c.name === "_medusa_cart_id")?.value
  expect(cartId, "cart cookie").toBeTruthy()
  const res = await request.get(`${BACKEND_URL}/store/shipping-options?cart_id=${cartId}`, {
    headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk },
  })
  const option = (await res.json()).shipping_options.find((o: { name: string }) => o.name === name)
  expect(option, `shipping option ${name}`).toBeTruthy()
  return option.id
}

/**
 * วาง order ผ่าน store API ด้วย token ของ customer (manual payment ของ seed) คืน id + display_id
 * CORE-20c: `quantity` ของ t-shirt และ `country` ของ region/ที่อยู่ (ค่าเริ่มต้น 1 และ STOREFRONT_COUNTRY)
 */
export async function placeOrder(
  request: APIRequestContext,
  pk: string,
  customer: Customer,
  { quantity = 1, country = STOREFRONT_COUNTRY }: { quantity?: number; country?: string } = {}
): Promise<{ id: string; displayId: number }> {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ store API ใน e2e
  const ok = async (res: APIResponse, what: string): Promise<any> => {
    expect(res.status(), `${what}: ${await res.text()}`).toBe(200)
    return res.json()
  }

  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) =>
    r.countries.some((c) => c.iso_2 === country)
  )
  const { variantId } = await variantOf(request, pk, "t-shirt")

  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, { headers, data: { region_id: region.id } }),
    "create cart"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
      headers,
      data: { variant_id: variantId, quantity },
    }),
    "add line item"
  )
  const address = {
    first_name: "Somchai",
    last_name: "Jaidee",
    address_1: "1 Sukhumvit Rd",
    city: "Bangkok",
    postal_code: "10110",
    country_code: country,
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
