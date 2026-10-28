import { APIRequestContext, APIResponse } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"
import { Customer, Headers, STOREFRONT_COUNTRY, adminHeaders, createCustomer, publishableKey, variantOf } from "./medusa"

// PAY-3b1: เตรียม draft order ของ group buy ผ่าน API (spec 04) — แคมเปญ active + pool group + ลูกค้า join ด้วย cart ของตัวเอง

const HOUR = 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload ของ admin/store API ใน e2e
async function ok(res: APIResponse, what: string, status = 200): Promise<any> {
  expect(res.status(), `${what}: ${await res.text()}`).toBe(status)
  return res.json()
}

export type GroupBuyOrderCtx = {
  admin: Headers
  pk: string
  customer: Customer
  groupId: string
  membershipId: string
  orderId: string
}

/** ลูกค้าใหม่ join กลุ่ม (membership `joined`); `succeed` → admin succeed กลุ่ม (GB-4 สร้าง payment collection, `awaiting_payment`) */
export async function groupBuyOrder(request: APIRequestContext, succeed: boolean): Promise<GroupBuyOrderCtx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await variantOf(request, pk, "t-shirt")
  const base = `${BACKEND_URL}/admin/group-buy`
  const { campaign } = await ok(
    await request.post(`${base}/campaigns`, {
      headers: admin,
      data: {
        name: `PAY-3b ${Date.now()}`,
        target_type: "orders",
        target_value: 5,
        group_mode: "pool",
        ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          max_quantity: 10,
          value: 10,
          target_rules: [{ attribute: "items.product.id", operator: "in", values: [productId] }],
        },
        rules: [{ attribute: "currency_code", operator: "in", values: ["thb"] }],
      },
    }),
    "create campaign"
  )
  await ok(await request.post(`${base}/campaigns/${campaign.id}/status`, { headers: admin, data: { status: "active" } }), "activate")
  const { group } = await ok(
    await request.post(`${base}/campaigns/${campaign.id}/groups`, { headers: admin, data: { name: "Pool PAY-3b" } }),
    "create pool group",
    201
  )

  const customer = await createCustomer(request, pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === STOREFRONT_COUNTRY))
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, {
      headers,
      data: { region_id: region.id, items: [{ variant_id: variantId, quantity: 1 }] },
    }),
    "create cart"
  )
  const { membership } = await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/groups/${group.join_token}/join`, { headers, data: { cart_id: cart.id } }),
    "join",
    201
  )
  if (succeed) {
    await ok(await request.post(`${base}/groups/${group.id}/succeed`, { headers: admin }), "succeed")
  }
  return { admin, pk, customer, groupId: group.id, membershipId: membership.id, orderId: membership.order_id }
}

/** ลูกค้าออกจากกลุ่ม → membership `cancelled` */
export async function leaveGroup(request: APIRequestContext, ctx: GroupBuyOrderCtx) {
  await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/memberships/${ctx.membershipId}/leave`, {
      headers: { authorization: `Bearer ${ctx.customer.token}`, "x-publishable-api-key": ctx.pk },
    }),
    "leave"
  )
}
