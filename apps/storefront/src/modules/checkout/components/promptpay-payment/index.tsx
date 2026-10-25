"use client"

import { getPromptPayState, initiatePaymentSession, placeOrder } from "@lib/data/cart"
import {
  PROMPTPAY_POLL_MS,
  formatCountdown,
  promptPayDeadline,
  promptPayExpiryAction,
  promptPayQrImage,
  secondsLeft,
} from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import { Button, Text } from "@modules/common/components/ui"
import { useStripe } from "@stripe/react-stripe-js"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type Props = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

type Qr = { image: string; deadline: number }

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
          Pay with PromptPay
        </Button>
        <ErrorMessage
          error="PromptPay is currently unavailable. Please choose another payment method."
          data-testid="promptpay-payment-error-message"
        />
      </>
    )
  }
  return <PromptPayCheckout {...props} />
}

const PromptPayCheckout = ({ cart, notReady, "data-testid": dataTestId }: Props) => {
  const stripe = useStripe()
  const [qr, setQr] = useState<Qr | null>(null)
  // ชำระแล้ว (PI succeeded/processing) แต่ webhook ยังไม่ complete cart → poll ต่อโดยไม่มี QR
  const [awaitingOrder, setAwaitingOrder] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finishing = useRef(false)

  const session = cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending")
  const clientSecret = session?.data?.client_secret as string | undefined
  const polling = !!qr || awaitingOrder

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    try {
      // cart ถูก complete โดย webhook แล้ว — complete ซ้ำได้ order เดิมแล้ว redirect ไปหน้า confirmed
      await placeOrder(cart.id)
    } catch {
      // เช่นรอ lock ของ completeCartWorkflow ไม่ทัน — poll รอบถัดไปจะลองใหม่ (order มีอยู่แล้ว)
      setError("Payment received. We are still finalising your order — please wait…")
    } finally {
      finishing.current = false
    }
  }, [cart.id])

  const expire = useCallback(async () => {
    setQr(null)
    // review PR #48: เช็กสถานะ PI ก่อน — ถ้าชำระแล้วห้ามลบ session (เงินถูกตัดแต่ไม่มี order)
    const current = stripe && clientSecret ? await stripe.retrievePaymentIntent(clientSecret) : null
    if (promptPayExpiryAction(current?.paymentIntent?.status) === "keep-polling") {
      setAwaitingOrder(true)
      return
    }
    setExpired(true)
    // สร้าง session ใหม่ = Medusa ลบ session เดิม → Stripe provider cancel PaymentIntent เดิม (cart ยังอยู่)
    await initiatePaymentSession(cart, { provider_id: session!.provider_id }).catch((err) =>
      setError(err instanceof Error ? err.message : String(err))
    )
  }, [stripe, clientSecret, cart, session])

  const showQr = async () => {
    if (!stripe || !clientSecret) return
    setSubmitting(true)
    setError(null)
    setExpired(false)

    // โหลดหน้าใหม่ระหว่างรอ: PaymentIntent ยังรอสแกนอยู่ → ใช้ QR เดิม ไม่ confirm ซ้ำ
    const current = await stripe.retrievePaymentIntent(clientSecret)
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
        setError(confirmed.error.message ?? "PromptPay payment failed")
        setSubmitting(false)
        return
      }
      intent = confirmed.paymentIntent
    }
    setSubmitting(false)

    const image = promptPayQrImage(intent)
    if (!intent || !image) {
      setError("Could not create the PromptPay QR code. Please try again.")
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
      const state = await getPromptPayState(cart.id)
      if (state === "paid") {
        finish()
      } else if (state === "failed") {
        clearInterval(timer)
        setQr(null)
        setAwaitingOrder(false)
        setError("PromptPay payment failed. Please try again.")
      }
    }, PROMPTPAY_POLL_MS)
    return () => clearInterval(timer)
  }, [polling, cart.id, finish])

  if (awaitingOrder) {
    return (
      <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-awaiting-order">
        <Text className="txt-medium-plus text-ui-fg-base" aria-live="polite">
          Payment received. Creating your order…
        </Text>
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  if (qr) {
    return (
      <div className="flex flex-col items-start gap-y-3" data-testid="promptpay-panel">
        <Text className="txt-medium-plus text-ui-fg-base">
          Scan the QR code with your banking app to pay
        </Text>
        {/* eslint-disable-next-line @next/next/no-img-element -- รูป QR จาก Stripe (URL ภายนอกที่เปลี่ยนต่อ payment) */}
        <img
          src={qr.image}
          alt="PromptPay QR code"
          width={240}
          height={240}
          className="border border-ui-border-base rounded-rounded"
          data-testid="promptpay-qr"
        />
        <Text className="txt-small text-ui-fg-subtle" aria-live="polite">
          Expires in <span data-testid="promptpay-countdown">{formatCountdown(secondsLeft(qr.deadline, now))}</span>
        </Text>
        <Text className="txt-small text-ui-fg-subtle">
          Waiting for payment confirmation… this page updates automatically.
        </Text>
        <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
      </div>
    )
  }

  return (
    <>
      {expired && (
        <Text className="txt-medium text-ui-fg-subtle mb-2" data-testid="promptpay-expired">
          The PromptPay QR code has expired. Your cart is still saved — try again to get a new code.
        </Text>
      )}
      <Button
        disabled={notReady || !stripe || !clientSecret}
        onClick={showQr}
        size="large"
        isLoading={submitting}
        data-testid={expired ? "promptpay-retry-button" : dataTestId}
      >
        {expired ? "Try again" : "Pay with PromptPay"}
      </Button>
      <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
    </>
  )
}

export default PromptPayPaymentButton
