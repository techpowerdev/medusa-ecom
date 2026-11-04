import { sdk } from "@lib/config"
import { placeOrder, PlaceOrderResult } from "@lib/data/cart"
import { setCartCookie } from "@lib/data/active-cart"
import { getAuthHeaders } from "@lib/data/cookies"
import { HttpTypes } from "@medusajs/types"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl

  const cartId = searchParams.get("cart_id")
  const countryCode = searchParams.get("country_code")
  const paymentIntent = searchParams.get("payment_intent")
  const paymentIntentClientSecret = searchParams.get(
    "payment_intent_client_secret"
  )
  const redirectStatus = searchParams.get("redirect_status")

  // Without a country code the middleware resolves the customer's region and
  // prefixes it; either way every redirect below stays on this origin.
  const prefix = countryCode ? `/${countryCode}` : ""
  const rejected = () =>
    NextResponse.redirect(`${origin}${prefix}/cart?error=payment_failed`)

  if (!cartId || !paymentIntent || !paymentIntentClientSecret) {
    return rejected()
  }

  const cart = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: { fields: "payment_collection.payment_sessions.data" },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ cart }) => cart)
    .catch(() => null)

  const paymentSession = cart?.payment_collection?.payment_sessions?.find(
    (session) => session.data?.id === paymentIntent
  )

  if (
    !paymentSession ||
    paymentSession.data?.client_secret !== paymentIntentClientSecret
  ) {
    return rejected()
  }

  // CORE-29 (กฎข้อ 86a): cookie เปลี่ยนเป็น cart นี้ → จำเป็นตะกร้าหลัก (cookie เดิมเป็น cart นี้อยู่แล้ว → ไม่เขียนซ้ำ)
  await setCartCookie(cartId)

  // The customer backed out or the bank declined. Stripe puts the PaymentIntent
  // back into `requires_payment_method`, so the Payment Element can mount
  // against it again — return to the payment step and let them retry.
  if (redirectStatus === "failed") {
    const params = new URLSearchParams({ step: "payment" })

    // Forward Stripe's own return parameters so the checkout step can tell how
    // the off-site authorization ended.
    for (const key of [
      "payment_intent",
      "payment_intent_client_secret",
      "redirect_status",
    ]) {
      const value = searchParams.get(key)

      if (value) {
        params.set(key, value)
      }
    }

    return NextResponse.redirect(`${origin}${prefix}/checkout?${params}`)
  }

  // CORE-4i-b (กฎข้อ 72): placeOrder ได้ order → redirect ไปหน้า confirmed (throw ของ Next — unstable_rethrow ส่งต่อ);
  // ไม่ได้ order (409, cart ไม่ complete, 401/403, network) → คืน { error } ไม่ throw
  // error ที่ไม่คาด (เช่นอ่าน cookie ล้ม) นับเป็น "failed" — ผลเหมือนกันคือกลับไปหน้า cart
  const { error } = await placeOrder(cartId).catch(
    (thrown: unknown): PlaceOrderResult => {
      unstable_rethrow(thrown)
      console.error(thrown)
      return { error: "failed" }
    }
  )

  // ทุก error (รวม code 409 และ unauthorized) → order_failed ข้อความเดียวที่หน้า cart
  console.error("payment-return: cart not converted into an order", error)
  return NextResponse.redirect(`${origin}${prefix}/cart?error=order_failed`)
}
