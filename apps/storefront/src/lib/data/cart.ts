"use server"

import { sdk } from "@lib/config"
import { friendlyErrorMessage } from "@lib/util/error-message"
import { isDigitalOnlyCart, safeCountryCode } from "@lib/util/digital-checkout"
import medusaError from "@lib/util/medusa-error"
import {
  ActionError,
  ActionResult,
  PaymentSessionResult,
  actionErrorMessage,
  actionFailure,
  paymentSessionResult,
} from "@lib/util/action-result"
import { INSUFFICIENT_INVENTORY, isInsufficientInventory } from "@lib/util/insufficient-inventory"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { setCartCookie } from "./active-cart"
import { syncCartAffiliateToken } from "./affiliate"
import { getLocale } from "./locale-actions"
import { createPaymentSession } from "./payment"
import { loginPathForAddToCart } from "@lib/util/pending-add-to-cart"
import { PromptPayPollState, promptPayPollState } from "@lib/util/payment-session"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @param fresh - skip Next's data cache. Client components re-reading the cart after a
 * mutation need it: the mutation's `revalidateTag` runs at the end of its action's response
 * stream, so a read the client starts as soon as the action resolves can still hit the
 * pre-mutation cache entry (CORE-19a).
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(
  cartId?: string,
  fields?: string,
  { fresh = false }: { fresh?: boolean } = {}
) {
  const id = cartId || (await getCartId())
  fields ??=
    "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, +items.requires_shipping, *promotions, +shipping_methods.name"

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields,
      },
      headers,
      ...(fresh ? { cache: "no-store" } : { next, cache: "force-cache" }),
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`ไม่พบภูมิภาคสำหรับประเทศ ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id,metadata")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers
    )
    cart = cartResp.cart

    // CORE-29 (กฎข้อ 86a): ตั้ง cookie + จำตะกร้าหลักไว้กู้หลัง login ใหม่ — เขียนล้มไม่ทำให้การสร้าง cart ล้ม
    await setCartCookie(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag, { expire: 0 })
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag, { expire: 0 })
  }

  // AF-2: cookie `aff` → cart metadata.affiliate_token
  // AF-3b (กฎ 23): ใช้ metadata จาก cart ที่อ่าน/สร้างข้างบน ไม่อ่าน cart ซ้ำ
  await syncCartAffiliateToken(cart.id, cart.metadata, headers)

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("ไม่พบตะกร้าสินค้า กรุณาเพิ่มสินค้าลงตะกร้าก่อน")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag, { expire: 0 })

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag, { expire: 0 })

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}) {
  if (!variantId) {
    throw new Error("ไม่พบตัวเลือกสินค้าที่จะเพิ่มลงตะกร้า")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  // CORE-6: ไม่มี guest — ยังไม่ล็อกอินให้ไปหน้า login พร้อม variant ที่ค้างไว้
  if (!("authorization" in headers)) {
    redirect(loginPathForAddToCart(countryCode, variantId, quantity))
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("ไม่สามารถสร้างหรือเรียกดูตะกร้าสินค้าได้ กรุณาลองใหม่อีกครั้ง")
  }

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers
    )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag, { expire: 0 })

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag, { expire: 0 })
    })
    .catch(medusaError)
}

// CORE-4i (spec 01 กฎข้อ 72): คืนผลแทนการ throw ผ่าน helper กลาง (แบบ deleteLineItem ของกฎข้อ 68)
export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}): Promise<ActionResult<typeof INSUFFICIENT_INVENTORY>> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // qa #160 D-1: ไม่มี JWT → middleware ล้าง `_medusa_cart_id` ไปแล้ว จึงต้องเช็กก่อน cart id
  if (!("authorization" in headers)) {
    return { error: "unauthorized" }
  }

  const cartId = await getCartId()

  if (!lineId || !cartId) {
    return { error: "failed" }
  }

  try {
    await sdk.store.cart.updateLineItem(cartId, lineId, { quantity }, {}, headers)
  } catch (error) {
    // CORE-48 (กฎข้อ 106a): 400 stock ไม่พอของ Medusa → code ของตัวเอง (ไม่ใช่ 409 ของ CHECKOUT_CONFLICTS) ก่อน helper กลาง
    if (isInsufficientInventory(error)) {
      return { error: INSUFFICIENT_INVENTORY }
    }
    return actionFailure(error)
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })

  const fulfillmentCacheTag = await getCacheTag("fulfillment")
  revalidateTag(fulfillmentCacheTag, { expire: 0 })

  return { ok: true }
}

// CORE-19d (spec 01 กฎข้อ 68): คืนผลแทนการ throw — Next ใน production ซ่อน error ที่ throw จาก server action
// client จึงแยก 401/403 (`FetchError.status`) ไม่ได้ถ้า throw
export type DeleteLineItemResult = ActionResult

export async function deleteLineItem(lineId: string): Promise<DeleteLineItemResult> {
  if (!lineId) {
    return { error: "failed" }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  // qa #160 D-1: ไม่มี JWT (หมดอายุ/ถูกลบ) → middleware ล้าง `_medusa_cart_id` ไปแล้ว จึงต้องเช็กก่อน cart id
  if (!("authorization" in headers)) {
    return { error: "unauthorized" }
  }

  const cartId = await getCartId()

  if (!cartId) {
    return { error: "failed" }
  }

  try {
    await sdk.store.cart.deleteLineItem(cartId, lineId, {}, headers)
  } catch (error) {
    return actionFailure(error)
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })

  const fulfillmentCacheTag = await getCacheTag("fulfillment")
  revalidateTag(fulfillmentCacheTag, { expire: 0 })

  return { ok: true }
}

// CORE-4i-b (กฎข้อ 72): คืนผลแทนการ throw ผ่าน helper กลาง
export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}): Promise<ActionResult> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    await sdk.store.cart.addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
  } catch (error) {
    return actionFailure(error)
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })
  return { ok: true }
}

/** สร้าง session ผ่าน `createPaymentSession` แล้ว revalidate cart เมื่อสำเร็จ (ผลผ่าน helper กลางของ Q-C2) */
async function createCartPaymentSession(collectionId: string, providerId: string): Promise<PaymentSessionResult> {
  const result = paymentSessionResult(await createPaymentSession(collectionId, providerId))
  if ("ok" in result) {
    revalidateTag(await getCacheTag("carts"), { expire: 0 })
  }
  return result
}

/**
 * CORE-4i-b (กฎข้อ 72, Q-C2 = (ก)): ผลรูปแบบเดียวกับหน้า `/account/orders/:id/pay` — ใช้ `createPaymentSession` (fetch ตรง)
 * แทน `sdk.store.payment.initiatePaymentSession` เพราะ `FetchError` ไม่เก็บ `code` ของ 409 `PAYMENT_ALREADY_COMPLETED`;
 * data ของกฎข้อ 5 (บัตร = card) ใส่ใน `createPaymentSession`; cart ที่ยังไม่มี collection สร้างก่อนด้วย route ของ Medusa (แบบ js-sdk)
 */
export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  { provider_id }: Pick<HttpTypes.StoreInitializePaymentSession, "provider_id">
): Promise<PaymentSessionResult> {
  let collectionId = cart.payment_collection?.id
  if (!collectionId) {
    try {
      const { payment_collection } = await sdk.client.fetch<HttpTypes.StorePaymentCollectionResponse>(
        `/store/payment-collections`,
        { method: "POST", headers: { ...(await getAuthHeaders()) }, body: { cart_id: cart.id } }
      )
      collectionId = payment_collection.id
    } catch (error) {
      return actionFailure(error)
    }
  }
  return createCartPaymentSession(collectionId, provider_id)
}

/**
 * PAY-6b (spec 06 กฎข้อ 7A, AC-12): สร้าง session PromptPay ใหม่ตอน QR หมดอายุ — 409 `PAYMENT_ALREADY_COMPLETED` (ชำระไปแล้ว)
 * เป็น code ที่ผู้เรียกแยกทาง (CORE-4i-b: ผลผ่าน helper กลาง)
 */
export async function renewPromptPaySession(
  cart: HttpTypes.StoreCart,
  providerId: string
): Promise<PaymentSessionResult> {
  const collectionId = cart.payment_collection?.id
  if (!collectionId) {
    return { error: "failed" }
  }
  return createCartPaymentSession(collectionId, providerId)
}

/**
 * PAY-2: สถานะการชำระ PromptPay ของ cart (อ่านอย่างเดียว ไม่ cache) — order ถูกสร้างโดย webhook
 * (spec 06 กฎข้อ 3) storefront แค่ poll จน cart ถูก complete
 */
export async function getPromptPayState(
  cartId: string
): Promise<PromptPayPollState> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const cart = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      // PAY-6c: `*payment_collection` (อยู่ใน defaults ของ store cart 2.22.1) ให้ captured_amount/refunded_amount เป็นสัญญาณ "คืนเงินแล้ว"
      query: { fields: "id,completed_at,*payment_collection,*payment_collection.payment_sessions" },
      headers,
      cache: "no-store",
    })
    .then(({ cart }) => cart)
    .catch(() => null)

  return promptPayPollState(cart)
}

// CORE-4i (กฎข้อ 72): คืนผลแทนการ throw — 409 PROMOTION_NOT_COMBINABLE เป็น code ที่ UI แยกข้อความ
export type ApplyPromotionsResult = ActionResult<"PROMOTION_NOT_COMBINABLE", { codes: string[] }>

export async function applyPromotions(codes: string[]): Promise<ApplyPromotionsResult> {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // qa #160 D-1: ไม่มี JWT → middleware ล้าง `_medusa_cart_id` ไปแล้ว จึงต้องเช็กก่อน cart id
  if (!("authorization" in headers)) {
    return { error: "unauthorized" }
  }

  const cartId = await getCartId()

  if (!cartId) {
    return { error: "failed" }
  }

  let cart: HttpTypes.StoreCart
  try {
    cart = (await sdk.store.cart.update(cartId, { promo_codes: codes }, {}, headers)).cart
  } catch (error) {
    return actionFailure(error, ["PROMOTION_NOT_COMBINABLE"])
  }

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag, { expire: 0 })

  const fulfillmentCacheTag = await getCacheTag("fulfillment")
  revalidateTag(fulfillmentCacheTag, { expire: 0 })

  // CORE-4g (กฎข้อ 63b): code ที่ใช้ไม่ได้ (เช่น campaign หมดอายุ) Medusa ตอบ 200 แต่ไม่ใส่ใน promotions
  // — คืน code ที่อยู่ใน cart จริงให้ผู้เรียกตรวจ
  return { ok: true, codes: (cart.promotions ?? []).flatMap((p) => (p.code ? [p.code] : [])) }
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[]
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData
) {
  const code = formData.get("code") as string
  const result = await applyPromotions([code])
  if ("error" in result) {
    // CORE-4e (กฎข้อ 55) / CORE-4i (กฎข้อ 72): แสดงข้อความไทยจากผลที่คืน
    return actionErrorMessage(result.error, "ใช้โค้ดส่วนลดไม่สำเร็จ กรุณาตรวจสอบโค้ดแล้วลองอีกครั้ง")
  }
}

// TODO: Pass a POJO instead of a form entity here
export async function setAddresses(currentState: unknown, formData: FormData) {
  if (!formData) {
    return "ไม่พบข้อมูลที่อยู่ กรุณากรอกใหม่อีกครั้ง"
  }
  const cartId = await getCartId()
  if (!cartId) {
    return "ไม่พบตะกร้าสินค้า กรุณาเพิ่มสินค้าลงตะกร้าก่อน"
  }
  let digitalOnly: boolean
  try {
    // EV-7d (spec 02 กฎข้อ 28b): ตัดสิน digital-only จาก cart ฝั่ง server ไม่รับ flag จากฟอร์ม
    const { cart } = await sdk.store.cart.retrieve(
      cartId,
      { fields: "id,items.requires_shipping" },
      await getAuthHeaders()
    )
    digitalOnly = isDigitalOnlyCart(cart)

    // ฟอร์มที่แสดงอยู่เป็นคนละแบบกับ cart ล่าสุด (เช่นแก้ตะกร้าจากอีกแท็บ — ไม่มีช่องที่อยู่ของแบบนั้นเลย) → ไม่บันทึกที่อยู่ว่างทับ
    if (!formData.has(digitalOnly ? "billing_address.address_1" : "shipping_address.address_1")) {
      return "ตะกร้าสินค้ามีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่แล้วกรอกที่อยู่อีกครั้ง"
    }

    // EV-7c (spec 02 กฎข้อ 24b): cart digital-only กรอกเฉพาะที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษี แล้วใช้เป็น
    // shipping_address ด้วย เพื่อให้ Tax module ของ Medusa คำนวณ VAT จากที่อยู่ — ข้ามขั้น delivery
    if (digitalOnly) {
      const address = billingAddressFrom(formData)
      await updateCart({
        email: formData.get("email"),
        billing_address: address,
        shipping_address: address,
      } as HttpTypes.StoreUpdateCart)
    } else {
      const data = {
        shipping_address: {
          first_name: formData.get("shipping_address.first_name"),
          last_name: formData.get("shipping_address.last_name"),
          address_1: formData.get("shipping_address.address_1"),
          address_2: "",
          company: formData.get("shipping_address.company"),
          postal_code: formData.get("shipping_address.postal_code"),
          city: formData.get("shipping_address.city"),
          country_code: formData.get("shipping_address.country_code"),
          province: formData.get("shipping_address.province"),
          phone: formData.get("shipping_address.phone"),
        },
        email: formData.get("email"),
      } as any

      const sameAsBilling = formData.get("same_as_billing")
      if (sameAsBilling === "on") data.billing_address = data.shipping_address

      if (sameAsBilling !== "on") data.billing_address = billingAddressFrom(formData)
      await updateCart(data)
    }
  } catch (e: unknown) {
    // CORE-4e (กฎข้อ 55): message ของ Medusa เป็นอังกฤษ — แสดงข้อความไทย
    return friendlyErrorMessage(e, "บันทึกที่อยู่ไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง")
  }

  // EV-7d (กฎข้อ 28c): country จาก URL ผ่าน safeCountryCode; ใช้ไม่ได้ → path ภายในร้าน ให้ middleware เลือกประเทศ (กัน open redirect)
  const countryCode = safeCountryCode(formData.get("checkout_country_code"))
  redirect(
    `${countryCode ? `/${countryCode}` : ""}/checkout?step=${digitalOnly ? "payment" : "delivery"}`
  )
}

function billingAddressFrom(formData: FormData) {
  return {
    first_name: formData.get("billing_address.first_name"),
    last_name: formData.get("billing_address.last_name"),
    address_1: formData.get("billing_address.address_1"),
    address_2: "",
    company: formData.get("billing_address.company"),
    postal_code: formData.get("billing_address.postal_code"),
    city: formData.get("billing_address.city"),
    country_code: formData.get("billing_address.country_code"),
    province: formData.get("billing_address.province"),
    phone: formData.get("billing_address.phone"),
  } as HttpTypes.StoreAddAddress
}

/**
 * AF-3b (spec 05 กฎ 23): sync cookie `aff` ลง cart ก่อนยืนยันการชำระที่ webhook อาจ complete cart เอง (Stripe/PromptPay)
 * ใช้ `metadata` ของ cart ที่หน้า checkout อ่านไว้แล้ว — POST เฉพาะเมื่อค่าต่าง ไม่อ่าน cart เพิ่ม
 */
export async function syncCartAffiliate(
  cartId: string,
  cartMetadata: HttpTypes.StoreCart["metadata"]
) {
  await syncCartAffiliateToken(cartId, cartMetadata, {
    ...(await getAuthHeaders()),
  })
}

const PLACE_ORDER_CONFLICTS = ["FLASH_SOLD_OUT", "FLASH_LIMIT_EXCEEDED", "PROMOTION_NOT_COMBINABLE"] as const
// สำเร็จ = redirect ของ Next (throw) จึงไม่มีผล ok
export type PlaceOrderResult = { error: ActionError<(typeof PLACE_ORDER_CONFLICTS)[number]> }

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @param cartMetadata - optional - `metadata` ของ cart ที่ผู้เรียกอ่านอยู่แล้ว (AF-3b กฎ 23): ส่งมา → sync cookie `aff`
 * ลง cart ก่อน complete เมื่อค่าต่าง; ไม่ส่ง (cart ถูก complete โดย webhook แล้ว เช่น PromptPay) → ไม่ sync
 * @param countryCode - optional - country ใน URL ของหน้า checkout (EV-7c กฎข้อ 24c, EV-7d กฎข้อ 28c) — ไม่ส่ง/ไม่ผ่าน
 * `safeCountryCode` → path ภายในร้าน ให้ middleware เลือกประเทศ (ไม่อ่านจาก shipping address)
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(
  cartId?: string,
  cartMetadata?: HttpTypes.StoreCart["metadata"],
  countryCode?: string
): Promise<PlaceOrderResult> {
  const id = cartId || (await getCartId())

  if (!id) {
    return { error: "failed" }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (cartMetadata !== undefined) {
    await syncCartAffiliateToken(id, cartMetadata, headers)
  }

  let cartRes: HttpTypes.StoreCompleteCartResponse
  try {
    cartRes = await sdk.store.cart.complete(id, {}, headers)
  } catch (error) {
    // FS-15 (spec 03 กฎข้อ 20c) / CORE-4i-b (กฎข้อ 72): 409 ที่รู้จักคืนเป็น code — UI แปลงเป็นข้อความไทยด้วย actionErrorMessage
    return actionFailure(error, PLACE_ORDER_CONFLICTS)
  }
  revalidateTag(await getCacheTag("carts"), { expire: 0 })

  if (cartRes.type === "order") {
    const orderCountry = safeCountryCode(countryCode)

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag, { expire: 0 })

    removeCartId()
    redirect(`${orderCountry ? `/${orderCountry}` : ""}/order/${cartRes.order.id}/confirmed`)
  }

  // Medusa คืน cart (ยังไม่ได้ order — เช่น authorize payment ไม่ผ่าน)
  console.error("placeOrder: cart not completed", cartRes.error)
  return { error: "failed" }
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`ไม่พบภูมิภาคสำหรับประเทศ ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag, { expire: 0 })
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag, { expire: 0 })

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag, { expire: 0 })

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
