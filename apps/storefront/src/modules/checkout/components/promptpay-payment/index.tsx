"use client"

import {
  getPromptPayState,
  placeOrder,
  renewPromptPaySession,
} from "@lib/data/cart"
import { syncAffiliateBefore } from "@lib/util/checkout-affiliate"
import {
  PROMPTPAY_POLL_MS,
  formatCountdown,
  promptPayFallbackAllowed,
  promptPayFallbackCanPoll,
  promptPayDeadline,
  promptPayExpiryAction,
  promptPayPollAction,
  promptPayQrImage,
  promptPaySession,
  secondsLeft,
} from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button, Text } from "@modules/common/components/ui"
import { useStripe } from "@stripe/react-stripe-js"
import { useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type Props = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

type Qr = { image: string; deadline: number }

const PAY_WITH_PROMPTPAY = "ชำระด้วยพร้อมเพย์"

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
        <Button disabled size="large" data-testid={props["data-testid"]}>
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
  const [qr, setQr] = useState<Qr | null>(null)
  // ชำระแล้ว (PI succeeded/processing) แต่ webhook ยังไม่ complete cart → poll ต่อโดยไม่มี QR
  const [awaitingOrder, setAwaitingOrder] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [expired, setExpired] = useState(false)
  // PAY-6c (กฎข้อ 8): ทางสำรองครบเพดานแล้วยังไม่มี order / เงินถูกคืนโดย Medusa ระหว่างทางสำรอง
  const [delayed, setDelayed] = useState(false)
  const [refunded, setRefunded] = useState(false)
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

  const finish = useCallback(async () => {
    if (finishing.current) return
    if (!takeFallbackSlot("complete")) return
    finishing.current = true
    try {
      // cart ถูก complete โดย webhook แล้ว — complete ซ้ำได้ order เดิมแล้ว redirect ไปหน้า confirmed
      await placeOrder(cart.id)
    } catch {
      // เช่นรอ lock ของ completeCartWorkflow ไม่ทัน — poll รอบถัดไปจะลองใหม่ (order มีอยู่แล้ว)
      setError("ได้รับชำระเงินแล้ว ระบบกำลังสร้างคำสั่งซื้อของคุณ กรุณารอสักครู่…")
    } finally {
      finishing.current = false
    }
  }, [cart.id, takeFallbackSlot])

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
    const renewed = await renewPromptPaySession(cart, session!.provider_id)
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
    setRefunded(false)

    // โหลดหน้าใหม่ระหว่างรอ: PaymentIntent ยังรอสแกนอยู่ → ใช้ QR เดิม ไม่ confirm ซ้ำ
    // AF-3b (กฎ 23): order สร้างโดย webhook หลังสแกน → sync cookie `aff` ก่อนทั้ง QR เดิม (requires_action) และการ confirm ใหม่
    const current = await syncAffiliateBefore(cart, () => stripe.retrievePaymentIntent(clientSecret))
    let intent = current.paymentIntent
    if (intent && promptPayExpiryAction(intent.status) === "keep-polling") {
      setSubmitting(false)
      setAwaitingOrder(true)
      return
    }
    if (intent && Date.now() >= promptPayDeadline(intent.created)) {
      setSubmitting(false)
      return expire()
    }
    if (intent?.status !== "requires_action") {
      const confirmed = await stripe.confirmPromptPayPayment(
        clientSecret,
        { payment_method: { billing_details: { email: cart.email ?? "" } } },
        { handleActions: false }
      )
      if (confirmed.error) {
        setError(confirmed.error.message ?? "ชำระด้วยพร้อมเพย์ไม่สำเร็จ")
        setSubmitting(false)
        return
      }
      intent = confirmed.paymentIntent
    }
    setSubmitting(false)

    const image = promptPayQrImage(intent)
    if (!intent || !image) {
      setError("สร้างคิวอาร์โค้ดพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      return
    }
    setNow(Date.now())
    setQr({ image, deadline: promptPayDeadline(intent.created) })
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
      const action = promptPayPollAction(state, completeFallback.current)
      if (action === "complete") {
        finish()
      } else if (action === "refunded") {
        // Medusa คืนเงินแล้วและสร้าง session ใหม่ให้ (refundPaymentAndRecreatePaymentSessionWorkflow) → โหลด cart ใหม่แล้วให้เริ่มชำระใหม่
        clearInterval(timer)
        completeFallback.current = false
        setAwaitingOrder(false)
        setError(null)
        setRefunded(true)
        router.refresh()
      } else if (action === "fail") {
        clearInterval(timer)
        setQr(null)
        setAwaitingOrder(false)
        setError("ชำระด้วยพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      }
    }, PROMPTPAY_POLL_MS)
    return () => clearInterval(timer)
  }, [polling, cart.id, finish, takeFallbackSlot, router])

  if (delayed) {
    return (
      <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-order-delayed">
        <Text className="txt-medium-plus text-ui-fg-base" aria-live="polite">
          ได้รับเงินแล้ว ระบบกำลังตรวจสอบคำสั่งซื้อของคุณ
        </Text>
        <Text className="txt-medium text-ui-fg-subtle">
          หากยังไม่ได้รับการยืนยันคำสั่งซื้อ กรุณา{" "}
          <LocalizedClientLink href="/contact" className="underline" data-testid="promptpay-contact-link">
            ติดต่อร้าน
          </LocalizedClientLink>
        </Text>
      </div>
    )
  }

  if (awaitingOrder) {
    return (
      <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-awaiting-order">
        <Text className="txt-medium-plus text-ui-fg-base" aria-live="polite">
          ได้รับชำระเงินแล้ว กำลังสร้างคำสั่งซื้อ…
        </Text>
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  if (qr) {
    return (
      <div className="flex flex-col items-start gap-y-3" data-testid="promptpay-panel">
        <Text className="txt-medium-plus text-ui-fg-base">
          สแกนคิวอาร์โค้ดด้วยแอปธนาคารเพื่อชำระเงิน
        </Text>
        {/* eslint-disable-next-line @next/next/no-img-element -- รูป QR จาก Stripe (URL ภายนอกที่เปลี่ยนต่อ payment) */}
        <img
          src={qr.image}
          alt="คิวอาร์โค้ดพร้อมเพย์"
          width={240}
          height={240}
          className="border border-ui-border-base rounded-rounded"
          data-testid="promptpay-qr"
        />
        <Text className="txt-small text-ui-fg-subtle" aria-live="polite">
          หมดอายุใน <span data-testid="promptpay-countdown">{formatCountdown(secondsLeft(qr.deadline, now))}</span>
        </Text>
        <Text className="txt-small text-ui-fg-subtle">
          กำลังรอยืนยันการชำระเงิน… หน้านี้จะอัปเดตอัตโนมัติ
        </Text>
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  return (
    <>
      {refunded && (
        <Text className="txt-medium text-ui-fg-subtle mb-2" data-testid="promptpay-refunded">
          ชำระไม่สำเร็จ เงินจะคืนเข้าบัญชีของคุณตามรอบของธนาคาร กดเริ่มชำระใหม่เพื่อรับคิวอาร์โค้ดใหม่
        </Text>
      )}
      {expired && (
        <Text className="txt-medium text-ui-fg-subtle mb-2" data-testid="promptpay-expired">
          คิวอาร์โค้ดพร้อมเพย์หมดอายุแล้ว ตะกร้าของคุณยังอยู่ กดลองอีกครั้งเพื่อรับคิวอาร์โค้ดใหม่
        </Text>
      )}
      <Button
        disabled={notReady || (!alreadyAuthorized && (!stripe || !clientSecret))}
        onClick={showQr}
        size="large"
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
