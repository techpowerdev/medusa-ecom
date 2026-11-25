import { sdk } from "@lib/config"
import { placeOrder, PlaceOrderResult } from "@lib/data/cart"
import { setCartCookie } from "@lib/data/active-cart"
import { getAuthHeaders } from "@lib/data/cookies"
import { safeCountryCode } from "@lib/util/digital-checkout"
import { checkoutReviewPath, loginPathForReturn } from "@lib/util/login-return"
import { HttpTypes } from "@medusajs/types"
import { unstable_rethrow } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl

  const cartId = searchParams.get("cart_id")
  // EV-7d (spec 02 กฎข้อ 28c): country จาก URL ของ return_url — ไม่ผ่าน → ให้ middleware เลือกประเทศ
  const countryCode = safeCountryCode(searchParams.get("country_code"))
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
  // PAY-12 (กฎข้อ 14; review/qa #481 D-1): session หมดอายุ → login แล้วกลับขั้น review — ผลการชำระยังไม่รู้จึงไม่บอกว่าล้ม;
  // ห้ามส่ง URL ของ route นี้เป็น return_to (มี payment_intent_client_secret) ไม่มี country → /account เฉยๆ
  // D-2: ขั้น review มี cart_id → cart ถูก complete แล้ว (webhook ระหว่าง login ใหม่) หน้า checkout พาไปหน้า confirmed ของ order นั้น
  const review = () => checkoutReviewPath(prefix, cartId ?? "")
  const signIn = () =>
    NextResponse.redirect(`${origin}${countryCode ? loginPathForReturn(countryCode, review()) : "/account"}`)

  if (!cartId || !paymentIntent || !paymentIntentClientSecret) {
    return rejected()
  }

  const read = await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: { fields: "payment_collection.payment_sessions.data" },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(
      ({ cart }) => ({ cart, status: 200 as unknown }),
      (error: { status?: unknown } | null) => ({ cart: null, status: error?.status })
    )

  if (read.status === 401 || read.status === 403) {
    return signIn()
  }
  // session หลักตัดสิน (#481): 5xx/network = ไม่รู้ผลการชำระ → ไม่บอกว่าล้ม; ขั้น review ทำ placeOrder/poll ต่อ (PAY-6b)
  // payment_failed เหลือเฉพาะที่รู้แน่ว่าไม่ได้จ่าย/ข้อมูลไม่ตรง (ไม่มี param, ไม่มี session/secret ไม่ตรง, 4xx อื่น, redirect_status=failed)
  if (!read.cart && (typeof read.status !== "number" || read.status >= 500)) {
    // PAY-18 (spec 06 กฎข้อ 20a): redirect_status=failed = รู้แน่ว่าจ่ายไม่สำเร็จ → ขั้น payment ไม่ใช่ review
    // (ไม่ส่งพารามิเตอร์ของ Stripe ต่อ — ยังไม่ได้ยืนยัน session กับ cart)
    return NextResponse.redirect(
      redirectStatus === "failed" ? `${origin}${prefix}/checkout?step=payment` : `${origin}${review()}`
    )
  }
  const { cart } = read

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
  // ไม่ได้ order (409, cart ไม่ complete, 401/403, network) → คืน { kind } ไม่ throw (CORE-76)
  // error ที่ไม่คาด (เช่นอ่าน cookie ล้ม) นับเป็น "failed" — ผลเหมือนกันคือกลับไปหน้า cart
  const place = () =>
    placeOrder(cartId, undefined, countryCode).catch((thrown: unknown): PlaceOrderResult => {
      unstable_rethrow(thrown)
      console.error(thrown)
      return { kind: "failed" }
    })
  const outcome = await place()

  // PAY-12 (spec 06 กฎข้อ 14): แยกทางตาม kind
  if (outcome.kind === "refunded") {
    return NextResponse.redirect(`${origin}${prefix}/cart?error=refunded`)
  }
  if (outcome.kind === "unauthorized") {
    return signIn()
  }
  if (outcome.kind === "processing") {
    // อ่าน order ของ cart: complete ซ้ำของ Medusa คืน order เดิมเมื่อมี link order_cart แล้ว (completeCartWorkflow 2.22.1)
    // → redirect หน้า confirmed (throw); ยังไม่มี → ขั้น review ซึ่ง poll ต่อด้วย placeOrder (PAY-6b)
    // ตั้งใจทิ้งผลครั้งที่สอง: kind ใดก็ตาม (processing/refunded/failed/unauthorized) ขั้น review จัดการจาก placeOrder ของตัวเองอยู่แล้ว
    await place()
    return NextResponse.redirect(`${origin}${review()}`)
  }

  console.error("payment-return: cart not converted into an order", outcome)
  return NextResponse.redirect(`${origin}${prefix}/cart?error=order_failed`)
}
