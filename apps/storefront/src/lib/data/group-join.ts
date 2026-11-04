"use server"

import { sdk } from "@lib/config"
import { actionFailure, type ActionResult } from "@lib/util/action-result"
import { groupJoinFailure, type GroupJoinActionError } from "@lib/util/group-join-error"
import type { GroupSelectionItem } from "@lib/util/group-page"
import { createCartWithItems, resolveRegion } from "@lib/util/server-cart"
import { getAuthHeaders } from "./cookies"
import { retrieveCustomer } from "./customer"
import { calculatePriceForShippingOption, listCartShippingMethods } from "./fulfillment"

// GB-7a2 (spec 04 กฎข้อ 29c, 31): server action ของการ join จากหน้ากลุ่ม — แยกจาก group-buy.ts (ใช้ server-cart ที่เป็น server-only)

/** GB-7a2: วิธีส่งของ cart ใหม่ — `amount` ของ option แบบ `calculated` คำนวณแล้ว */
export type GroupShippingOption = { id: string; name: string; amount: number }
export type GroupCart = { cart: { id: string; metadata: Record<string, unknown> | null }; currency_code: string; shipping_options: GroupShippingOption[] }

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "country_code",
  "province",
  "postal_code",
  "phone",
] as const

/**
 * GB-7a2 (spec 04 กฎข้อ 29c1, 31b): cart ใหม่หลาย line ตามรายการ + ที่อยู่ที่บันทึกไว้ของลูกค้า — **ไม่**แตะ cart ปัจจุบัน
 * (ไม่ activateCart/setCartId; กฎข้อ 14c) แล้วคืนวิธีส่งของ cart นี้ (`listCartShippingMethods` รับ cart id)
 */
export async function prepareGroupCart(input: {
  countryCode: string
  addressId: string
  items: GroupSelectionItem[]
}): Promise<ActionResult<never, GroupCart>> {
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) return { error: "unauthorized" }
  try {
    const [resolved, customer] = await Promise.all([resolveRegion(input.countryCode), retrieveCustomer()])
    const address = customer?.addresses?.find((a) => a.id === input.addressId)
    if (!customer || !address || !resolved || !input.items.length) return { error: "failed" }

    const cartId = await createCartWithItems(resolved.region.id, input.items, headers)
    const shippingAddress = Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, address[k] ?? undefined]))
    const { cart } = await sdk.store.cart.update(
      cartId,
      { shipping_address: shippingAddress, billing_address: shippingAddress, email: customer.email },
      {},
      headers
    )
    const options = (await listCartShippingMethods(cartId)) ?? []
    const shipping_options = (
      await Promise.all(
        options
          .filter((o) => o.service_zone?.fulfillment_set?.type !== "pickup")
          .map(async (o) => {
            const amount =
              o.price_type === "calculated" ? (await calculatePriceForShippingOption(o.id, cartId))?.amount : o.amount
            return typeof amount === "number" ? { id: o.id, name: o.name, amount } : null
          })
      )
    ).filter((o): o is GroupShippingOption => !!o)
    return {
      ok: true,
      cart: { id: cart.id, metadata: (cart.metadata as Record<string, unknown> | null) ?? null },
      currency_code: cart.currency_code,
      shipping_options,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

/**
 * GB-7a2 (spec 04 กฎข้อ 29c2, 29f): join ด้วย cart ใหม่ — ผู้เรียกต้อง sync cookie `aff` ลง cart ก่อน (กฎข้อ 27, static test ของ spec 05 กฎ 31)
 * error → code ของ GB-7a2a ผ่าน `groupJoinFailure` (ข้อความไทยแปลงฝั่ง client)
 */
export async function joinGroupBuy(token: string, cartId: string): Promise<{ ok: true } | { error: GroupJoinActionError }> {
  return sdk.client
    .fetch(`/store/group-buy/groups/${encodeURIComponent(token)}/join`, {
      method: "POST",
      body: { cart_id: cartId },
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    .then(() => ({ ok: true as const }))
    .catch(groupJoinFailure)
}
