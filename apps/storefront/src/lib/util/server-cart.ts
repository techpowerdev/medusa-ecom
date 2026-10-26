import "server-only"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheTag, setCartId } from "@lib/data/cookies"
import { listRegions } from "@lib/data/regions"
import { FetchError } from "@medusajs/js-sdk"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { getDefaultCountryCode } from "./site"

export const MAX_LINE_ITEM_QUANTITY = 100

/** Stores the cart in the shopper's cookie and clears cached cart reads. */
export const activateCart = async (cartId: string) => {
  await setCartId(cartId)
  const cartCacheTag = await getCacheTag("carts")
  if (cartCacheTag) {
    revalidateTag(cartCacheTag, { expire: 0 })
  }
}

/**
 * Resolves the region from an explicit country code, falling back to the
 * store's default country only when none was requested.
 */
export const resolveRegion = async (
  countryCode?: string
): Promise<{ countryCode: string; region: HttpTypes.StoreRegion } | null> => {
  const regions = await listRegions()
  const code = countryCode?.toLowerCase() || getDefaultCountryCode(regions)
  const region = regions.find((r) => r.countries?.some((c) => c.iso_2 === code))
  return code && region ? { countryCode: code, region } : null
}

const createCartWithItems = async (
  regionId: string,
  items: { variant_id: string; quantity: number }[],
  headers: Record<string, string>
) => {
  const { cart } = await sdk.store.cart.create({ region_id: regionId }, {}, headers)
  for (const item of items) {
    await sdk.store.cart.createLineItem(cart.id, item, {}, headers)
  }
  return cart.id
}

/** Returns the requested variant IDs that don't exist in the store's sales channel. */
const findMissingVariantIds = async (variantIds: string[]) => {
  const { variants } = await sdk.client.fetch<{
    variants: { id: string }[]
  }>("/store/product-variants", {
    query: { id: variantIds, fields: "id", limit: variantIds.length },
  })
  const found = new Set(variants.map((variant) => variant.id))
  return variantIds.filter((id) => !found.has(id))
}

const ITEM_PATTERN = /^([A-Za-z0-9._-]+|~[A-Za-z0-9_-]+):([1-9][0-9]*)$/

const decodeItemId = (token: string) =>
  token.startsWith("~")
    ? Buffer.from(token.slice(1), "base64url").toString("utf8")
    : token

const parseItems = (raw: string) => {
  const items: { variant_id: string; quantity: number }[] = []
  for (const pair of decodeURIComponent(raw).split(",")) {
    const match = pair.match(ITEM_PATTERN)
    if (!match) {
      return null
    }
    const quantity = Number(match[2])
    if (quantity > MAX_LINE_ITEM_QUANTITY) {
      return null
    }
    items.push({ variant_id: decodeItemId(match[1]), quantity })
  }
  return items.length ? items : null
}

export type BuyResult =
  | { next: "login" | "checkout"; countryCode: string }
  | { error: string; status: number }

/**
 * Cart permalink `/buy/{variant_id}:{quantity},...`: สร้าง cart ของ customer ที่ล็อกอินอยู่แล้วตั้งเป็น cart ปัจจุบัน
 * CORE-14 (spec 01 AC-41, กฎ 25): ไม่มี session หรือ token ใช้ไม่ได้ → `next: "login"` โดยไม่สร้าง cart
 * ใช้ทั้งใน route `/buy/[items]` และ server action login (กลับมาจาก return URL)
 */
export const buyFromPermalink = async (
  rawItems: string,
  country: string | null
): Promise<BuyResult> => {
  const items = parseItems(rawItems)
  if (!items) {
    return {
      error: "ลิงก์ไม่ถูกต้อง รูปแบบที่ใช้ได้คือ /buy/{variant_id}:{quantity},...",
      status: 400,
    }
  }

  const resolved = await resolveRegion(country ?? undefined)
  if (!resolved) {
    return { error: "ร้านนี้ไม่จัดส่งไปยังประเทศที่ระบุ", status: 400 }
  }
  const { countryCode, region } = resolved

  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) {
    return { next: "login", countryCode }
  }

  const missing = await findMissingVariantIds(items.map((item) => item.variant_id))
  if (missing.length) {
    return { error: `ไม่พบสินค้า: ${missing.join(", ")}`, status: 404 }
  }

  let cartId: string
  try {
    cartId = await createCartWithItems(region.id, items, headers)
  } catch (error) {
    if ((error as FetchError).status === 401) {
      return { next: "login", countryCode }
    }
    return { error: "มีสินค้าบางรายการในลิงก์นี้ที่ซื้อไม่ได้", status: 400 }
  }

  await activateCart(cartId)
  return { next: "checkout", countryCode }
}
