"use client"

import {
  getPromptPayState,
  placeOrder,
  renewPromptPaySession,
} from "@lib/data/cart"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { syncAffiliateBefore } from "@lib/util/checkout-affiliate"
import {
  PROMPTPAY_REFUNDED_UNKNOWN,
  PromptPayRefunded,
  promptPayFinishAction,
  promptPayPollWhileFinishing,
} from "@lib/util/promptpay-finish"
import {
  PAYMENT_ALREADY_COMPLETED,
  PROMPTPAY_POLL_MS,
  promptPayFallbackAllowed,
  promptPayFallbackCanPoll,
  promptPayExpiryAction,
  promptPayPollAction,
  promptPaySession,
  secondsLeft,
} from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@/components/button"
import { useStripe } from "@stripe/react-stripe-js"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import RefundedGoToCart from "../refunded-go-to-cart"
import { openQr } from "./open-qr"
import PromptPayOrderDelayed from "./order-delayed"
import PromptPayQr from "./qr-panel"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type Props = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

type Qr = { image: string; deadline: number }

const PAY_WITH_PROMPTPAY = "ชำระด้วยพร้อมเพย์"

/**
 * CORE-4i-b (กฎข้อ 72): สร้าง session พร้อมเพย์ใหม่ตอน QR หมดอายุ — 409 `PAYMENT_ALREADY_COMPLETED` → already-paid (PAY-6b),
 * ล้มแบบอื่น → ข้อความไทย (`unauthorized` → SIGN_IN_AGAIN_MESSAGE)
 */
export const renewPromptPayQr = async (
  cart: HttpTypes.StoreCart,
  providerId: string
): Promise<{ status: "renewed" | "already-paid" } | { status: "error"; message: string }> => {
  const result = await settleAction(renewPromptPaySession(cart, providerId))
  if ("ok" in result) return { status: "renewed" }
  if (result.error === PAYMENT_ALREADY_COMPLETED) return { status: "already-paid" }
  return { status: "error", message: actionErrorMessage(result.error, "สร้างคิวอาร์โค้ดพร้อมเพย์ใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง") }
}

/**
 * PAY-2 (spec 06): PromptPay — แสดง QR เอง (confirmPromptPayPayment แบบ handleActions: false),
 * poll cart จน webhook สร้าง order (กฎข้อ 3) และหมดอายุ 10 นาทีนับจากสร้าง PaymentIntent
 * → ถ้ายังไม่ชำระ ยกเลิก session แล้วลองใหม่ได้
 */
const PromptPayPaymentButton = (props: Props) => {
  // ไม่มี NEXT_PUBLIC_STRIPE_KEY → ไม่มี <Elements> ให้ useStripe(): แสดง error ชัดแทนหน้าพัง
  const stripeReady = useContext(StripeContext)
  if (!stripeReady) {
    return (
      <>
        <Button disabled data-testid={props["data-testid"]}>
          {PAY_WITH_PROMPTPAY}
        </Button>
        <ErrorMessage
          error="ขณะนี้ชำระด้วยพร้อมเพย์ไม่ได้ กรุณาเลือกวิธีชำระเงินอื่น"
          data-testid="promptpay-payment-error-message"
        />
      </>
    )
  }
  return <PromptPayCheckout {...props} />
}

const PromptPayCheckout = ({ cart, notReady, "data-testid": dataTestId }: Props) => {
  const stripe = useStripe()
  const router = useRouter()
  const { countryCode } = useParams()
  const [qr, setQr] = useState<Qr | null>(null)
  // ชำระแล้ว (PI succeeded/processing) แต่ webhook ยังไม่ complete cart → poll ต่อโดยไม่มี QR
  const [awaitingOrder, setAwaitingOrder] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [expired, setExpired] = useState(false)
  // PAY-6c (กฎข้อ 8): ทางสำรองครบเพดานแล้วยังไม่มี order / เงินถูกคืนโดย Medusa ระหว่างทางสำรอง
  const [delayed, setDelayed] = useState(false)
  // `promptpay-refunded` (PAY-11: เหตุจาก placeOrder ของทางสำรอง → ไปตะกร้า PAY-15 / PAY-6c: ไม่รู้เหตุ → เริ่มชำระใหม่)
  const [refunded, setRefunded] = useState<PromptPayRefunded | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finishing = useRef(false)
  // AC-12b: ชำระแล้วแต่ยังไม่มี order (409 / session authorized) → ทุกรอบ poll ลอง complete cart ซ้ำจนได้ order
  const completeFallback = useRef(false)
  // PAY-6c: จำนวน request (complete cart + poll) ของทางสำรองนับจากได้ 409 — เพดาน PROMPTPAY_FALLBACK_MAX_REQUESTS
  const fallbackUsed = useRef(0)

  const session = promptPaySession(cart.payment_collection?.payment_sessions)
  const clientSecret = session?.data?.client_secret as string | undefined
  // PAY-6b: session ถูก authorize แล้ว (guard/webhook) แต่ cart ยังไม่ complete → ชำระแล้ว ไม่ต้องแสดง QR
  const alreadyAuthorized = session?.status === "authorized"
  const polling = !!qr || awaitingOrder

  // PAY-6c: ครบเพดานทางสำรอง → หยุดยิง request (polling=false ล้าง timer) แล้วให้ติดต่อร้าน
  const giveUp = useCallback(() => {
    setAwaitingOrder(false)
    setDelayed(true)
  }, [])

  /**
   * ทางสำรองยิง request ได้อีกไหม (นับเฉพาะโหมดทางสำรอง) — ครบเพดาน → giveUp
   * poll ต้องเหลือ slot ให้ complete ต่ออีกหนึ่ง (review #136) จึงหยุด poll เมื่อเหลือ < 2
   */
  const takeFallbackSlot = useCallback((kind: "poll" | "complete") => {
    if (!completeFallback.current) return true
    const allowed = kind === "poll" ? promptPayFallbackCanPoll : promptPayFallbackAllowed
    if (!allowed(fallbackUsed.current)) {
      giveUp()
      return false
    }
    fallbackUsed.current++
    return true
  }, [giveUp])

  // เงินถูกคืน (หรือจะถูกคืน) → หยุดทางสำรอง (completeFallback=false: poll ที่ค้างอยู่ได้ "wait" ไม่เขียนทับเหตุ;
  // awaitingOrder=false ล้าง timer poll) แล้วโหลด cart ใหม่ — Medusa คืนเงินและสร้าง session ใหม่ให้
  // (refundPaymentAndRecreatePaymentSessionWorkflow); สิ่งที่แสดงต่อตาม `next`: รู้เหตุ → ไปที่ตะกร้า (PAY-15), ไม่รู้เหตุ → เริ่มชำระใหม่ (PAY-6c)
  const stopRefunded = useCallback((next: PromptPayRefunded) => {
    completeFallback.current = false
    setAwaitingOrder(false)
    setError(null)
    setRefunded(next)
    router.refresh()
  }, [router])

  const finish = useCallback(async () => {
    if (finishing.current) return
    if (!takeFallbackSlot("complete")) return
    finishing.current = true
    let action = promptPayFinishAction(null)
    try {
      // cart ถูก complete โดย webhook แล้ว — complete ซ้ำได้ order เดิมแล้ว redirect ไปหน้า confirmed
      // EV-7d (กฎข้อ 28c): หน้า confirmed ใช้ country ของ URL ปัจจุบัน
      // PAY-11 (กฎข้อ 13): ผลล้มที่ placeOrder คืนเป็นค่า → แยกตาม kind ของ placeOrderOutcome (CORE-76)
      action = promptPayFinishAction(await placeOrder(cart.id, undefined, countryCode as string))
    } catch {
      // network — poll รอบถัดไปจะลองใหม่
    } finally {
      finishing.current = false
    }
    if (action.kind === "refunded") return stopRefunded(action)
    if (action.kind === "unauthorized") return router.push(`/${countryCode}/account`)
    // เช่นรอ lock ของ completeCartWorkflow ไม่ทัน (CART_COMPLETION_IN_PROGRESS) — poll รอบถัดไปจะลองใหม่ (order มีอยู่แล้ว)
    setError("ได้รับชำระเงินแล้ว ระบบกำลังสร้างคำสั่งซื้อของคุณ กรุณารอสักครู่…")
  }, [cart.id, countryCode, takeFallbackSlot, stopRefunded, router])

  // PAY-6b (spec 06 กฎข้อ 7A, AC-12b): ชำระแล้วแต่ยังไม่มี order → poll ต่อ และเรียก complete cart ของ Medusa เป็นทางสำรอง
  // (กรณี webhook ไม่มาหรือ complete จาก webhook ล้ม) complete ล้ม → finish แสดงข้อความแล้ว poll รอบถัดไปลองใหม่เมื่อ cart complete
  const awaitOrder = useCallback(() => {
    completeFallback.current = true
    fallbackUsed.current = 0
    setAwaitingOrder(true)
    finish()
  }, [finish])

  const expire = useCallback(async () => {
    setQr(null)
    // review PR #48: เช็กสถานะ PI ก่อน — ถ้าชำระแล้วห้ามลบ session (เงินถูกตัดแต่ไม่มี order)
    const current = stripe && clientSecret ? await stripe.retrievePaymentIntent(clientSecret) : null
    if (promptPayExpiryAction(current?.paymentIntent?.status) === "keep-polling") {
      setAwaitingOrder(true)
      return
    }
    // สร้าง session ใหม่ = Medusa ลบ session เดิม → Stripe provider cancel PaymentIntent เดิม (cart ยังอยู่)
    // PAY-6b: guard ของ backend ตอบ 409 PAYMENT_ALREADY_COMPLETED ถ้าชำระไปแล้ว (race) → ไม่แสดงหมดอายุ
    setSubmitting(true) // ระหว่างรอผลห้ามกดปุ่มซ้ำ
    const renewed = await renewPromptPayQr(cart, session!.provider_id)
    setSubmitting(false)
    if (renewed.status === "already-paid") {
      awaitOrder()
      return
    }
    setExpired(true)
    if (renewed.status === "error") {
      setError(renewed.message)
    }
  }, [stripe, clientSecret, cart, session, awaitOrder])

  const showQr = async () => {
    if (alreadyAuthorized) {
      setError(null)
      return awaitOrder()
    }
    if (!stripe || !clientSecret) return
    setSubmitting(true)
    setError(null)
    setExpired(false)
    setRefunded(null)

    // AF-3b (กฎ 23): order สร้างโดย webhook หลังสแกน → sync cookie `aff` ก่อนทั้ง QR เดิม (requires_action) และการ confirm ใหม่ใน openQr
    const current = await syncAffiliateBefore(cart, () => stripe.retrievePaymentIntent(clientSecret))
    const step = await openQr(stripe, clientSecret, cart.email ?? "", current.paymentIntent)
    setSubmitting(false)
    if (step.kind === "paid") return setAwaitingOrder(true)
    if (step.kind === "expired") return expire()
    if (step.kind === "error") return setError(step.message)
    setNow(Date.now())
    setQr({ image: step.image, deadline: step.deadline })
  }

  // นับถอยหลัง → ครบ 10 นาทีตัดสินจากสถานะ PI
  useEffect(() => {
    if (!qr) return
    const timer = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (secondsLeft(qr.deadline, t) === 0) {
        clearInterval(timer)
        expire()
      }
    }, 1_000)
    return () => clearInterval(timer)
  }, [qr, expire])

  // poll สถานะจน webhook complete cart (ถ้า finish ล้ม รอบถัดไปลองใหม่)
  useEffect(() => {
    if (!polling) return
    const timer = setInterval(async () => {
      if (!takeFallbackSlot("poll")) {
        clearInterval(timer)
        return
      }
      // อ่านสถานะล้ม (network) = ยังไม่รู้ → ถือเป็น pending แล้วรอบถัดไปลองใหม่
      const state = await getPromptPayState(cart.id).catch(() => "pending" as const)
      // PAY-17 (กฎข้อ 19b): finish() กำลังรอ placeOrder → refunded ของ poll ไม่ตัดสิน ให้ผลของ placeOrder ตัดสิน
      const action = promptPayPollWhileFinishing(promptPayPollAction(state, completeFallback.current), finishing.current)
      if (action === "complete") {
        finish()
      } else if (action === "refunded") {
        clearInterval(timer)
        stopRefunded(PROMPTPAY_REFUNDED_UNKNOWN)
      } else if (action === "fail") {
        clearInterval(timer)
        setQr(null)
        setAwaitingOrder(false)
        setError("ชำระด้วยพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      }
    }, PROMPTPAY_POLL_MS)
    return () => clearInterval(timer)
  }, [polling, cart.id, finish, takeFallbackSlot, stopRefunded])

  if (delayed) {
    return <PromptPayOrderDelayed />
  }

  if (awaitingOrder) {
    return (
      <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-awaiting-order">
        <p className="text-sm leading-[1.4rem] font-medium text-foreground" aria-live="polite">
          ได้รับชำระเงินแล้ว กำลังสร้างคำสั่งซื้อ…
        </p>
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  if (qr) {
    return (
      <div className="flex flex-col items-start gap-y-3" data-testid="promptpay-panel">
        <PromptPayQr image={qr.image} deadline={qr.deadline} now={now} />
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  const refundedNotice = refunded && (
    <p className="text-sm leading-[1.4rem] text-muted-foreground mb-2" data-testid="promptpay-refunded">
      {refunded.text}
    </p>
  )

  // PAY-15 (กฎข้อ 17): เหตุที่รู้ยังอยู่ในตะกร้าเดิม → ไม่มีปุ่มเริ่มชำระใหม่ ให้ไปปรับตะกร้าแทน
  if (refunded?.goToCart) {
    return <RefundedGoToCart text={refunded.text} noticeTestId="promptpay-refunded" linkTestId="promptpay-go-to-cart" />
  }

  return (
    <>
      {refundedNotice}
      {expired && (
        <p className="text-sm leading-[1.4rem] text-muted-foreground mb-2" data-testid="promptpay-expired">
          คิวอาร์โค้ดพร้อมเพย์หมดอายุแล้ว ตะกร้าของคุณยังอยู่ กดลองอีกครั้งเพื่อรับคิวอาร์โค้ดใหม่
        </p>
      )}
      <Button
        disabled={notReady || (!alreadyAuthorized && (!stripe || !clientSecret))}
        onClick={showQr}
        isLoading={submitting}
        data-testid={expired || refunded ? "promptpay-retry-button" : dataTestId}
      >
        {refunded ? "เริ่มชำระใหม่" : expired ? "ลองอีกครั้ง" : PAY_WITH_PROMPTPAY}
      </Button>
      <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
    </>
  )
}

export default PromptPayPaymentButton
