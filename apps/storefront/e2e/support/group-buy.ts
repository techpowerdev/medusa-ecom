import { APIRequestContext, APIResponse } from "@playwright/test"

import { BACKEND_URL, expect } from "./fixtures"
import {
  Customer,
  Headers,
  STOREFRONT_COUNTRY,
  adminHeaders,
  createCustomer,
  publishableKey,
  variantIdsByOption,
  variantOf,
} from "./medusa"

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

export type TeamGroupCtx = { admin: Headers; pk: string; variantId: string; regionId: string; groupId: string; token: string }

/**
 * GB-7a1 (AC-16a): แคมเปญ team `target_type=people` (`target_value`) + ทีมที่ลูกค้าคนแรกสร้างผ่าน store route (GB-3)
 * — สร้างทีมอย่างเดียว ไม่ join (กฎข้อ 29g); สมาชิกเข้าร่วมด้วย `joinAsNewCustomer`
 */
export async function teamGroup(request: APIRequestContext, targetValue: number): Promise<TeamGroupCtx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await variantOf(request, pk, "t-shirt")
  const base = `${BACKEND_URL}/admin/group-buy`
  const { campaign } = await ok(
    await request.post(`${base}/campaigns`, {
      headers: admin,
      data: {
        name: `GB-7a1 ${Date.now()}`,
        target_type: "people",
        target_value: targetValue,
        group_mode: "team",
        team_duration_hours: 24,
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
  const creator = await createCustomer(request, pk)
  const { group } = await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/groups`, {
      headers: { authorization: `Bearer ${creator.token}`, "x-publishable-api-key": pk },
      data: { campaign_id: campaign.id },
    }),
    "create team",
    201
  )
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers: { "x-publishable-api-key": pk } }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === STOREFRONT_COUNTRY))
  return { admin, pk, variantId, regionId: region.id, groupId: group.id, token: group.join_token }
}

/** ลูกค้าใหม่ join กลุ่มด้วย cart ของตัวเอง (membership `joined`) */
export async function joinAsNewCustomer(request: APIRequestContext, ctx: TeamGroupCtx) {
  const customer = await createCustomer(request, ctx.pk)
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": ctx.pk }
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, {
      headers,
      data: { region_id: ctx.regionId, items: [{ variant_id: ctx.variantId, quantity: 1 }] },
    }),
    "create cart"
  )
  await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/groups/${ctx.token}/join`, { headers, data: { cart_id: cart.id } }),
    "join",
    201
  )
}

export type PoolGroupCtx = TeamGroupCtx & { variants: Record<string, string> }

/** GB-7a2 (AC-28): แคมเปญ pool สินค้าเดียว (t-shirt) + pool group — ข้อจำกัดต่อคน/ต่อกลุ่มตามที่ส่ง */
export async function poolGroup(
  request: APIRequestContext,
  limits: { max_units_per_person?: number; max_people_per_group?: number } = {}
): Promise<PoolGroupCtx> {
  const admin = await adminHeaders(request)
  const pk = await publishableKey(request, admin)
  const { productId, variantId } = await variantOf(request, pk, "t-shirt")
  const variants = await variantIdsByOption(request, pk, "t-shirt")
  const base = `${BACKEND_URL}/admin/group-buy`
  const { campaign } = await ok(
    await request.post(`${base}/campaigns`, {
      headers: admin,
      data: {
        name: `GB-7a2 ${Date.now()}`,
        target_type: "orders",
        target_value: 5,
        group_mode: "pool",
        ends_at: new Date(Date.now() + 48 * HOUR).toISOString(),
        ...limits,
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
    await request.post(`${base}/campaigns/${campaign.id}/groups`, { headers: admin, data: { name: "Pool GB-7a2" } }),
    "create pool group",
    201
  )
  const { regions } = await ok(await request.get(`${BACKEND_URL}/store/regions`, { headers: { "x-publishable-api-key": pk } }), "regions")
  const region = regions.find((r: { countries: { iso_2: string }[] }) => r.countries.some((c) => c.iso_2 === STOREFRONT_COUNTRY))
  return { admin, pk, variantId, variants, regionId: region.id, groupId: group.id, token: group.join_token }
}

export type AddressInput = { first_name: string; last_name: string; address_1: string; city: string; postal_code: string; phone: string }

/** ที่อยู่ที่บันทึกไว้ของลูกค้า (ประเทศไทย) — คืน id ตามลำดับที่ส่ง */
export async function addAddresses(request: APIRequestContext, pk: string, customer: Customer, list: AddressInput[]) {
  const headers = { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": pk }
  const ids: string[] = []
  for (const a of list) {
    const { customer: c } = await ok(
      await request.post(`${BACKEND_URL}/store/customers/me/addresses`, {
        headers,
        data: { ...a, country_code: STOREFRONT_COUNTRY },
      }),
      "add address"
    )
    ids.push(c.addresses.find((x: { address_1: string }) => x.address_1 === a.address_1).id)
  }
  return ids
}

/** cart ของลูกค้าผ่าน store API (token ของเจ้าของ cart) — คืน id */
export async function cartWithItems(
  request: APIRequestContext,
  ctx: Pick<TeamGroupCtx, "pk" | "regionId">,
  customer: Customer,
  items: { variant_id: string; quantity: number }[]
): Promise<string> {
  const { cart } = await ok(
    await request.post(`${BACKEND_URL}/store/carts`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": ctx.pk },
      data: { region_id: ctx.regionId, items },
    }),
    "create cart"
  )
  return cart.id
}

/** join ผ่าน store API ด้วย cart ใหม่ของลูกค้าคนนี้ */
export async function joinWith(
  request: APIRequestContext,
  ctx: TeamGroupCtx,
  customer: Customer,
  items: { variant_id: string; quantity: number }[]
) {
  const cartId = await cartWithItems(request, ctx, customer, items)
  await ok(
    await request.post(`${BACKEND_URL}/store/group-buy/groups/${ctx.token}/join`, {
      headers: { authorization: `Bearer ${customer.token}`, "x-publishable-api-key": ctx.pk },
      data: { cart_id: cartId },
    }),
    "join",
    201
  )
}
