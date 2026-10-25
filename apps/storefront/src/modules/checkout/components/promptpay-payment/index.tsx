"use client"

import { getPromptPayState, initiatePaymentSession, placeOrder } from "@lib/data/cart"
import {
  PROMPTPAY_POLL_MS,
  PROMPTPAY_TIMEOUT_MS,
  formatCountdown,
  promptPayQrImage,
  secondsLeft,
} from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import { Button, Text } from "@modules/common/components/ui"
import { useStripe } from "@stripe/react-stripe-js"
import { useCallback, useEffect, useRef, useState } from "react"
import ErrorMessage from "../error-message"

type Props = {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

type Qr = { image: string; deadline: number }

/**
 * PAY-2 (spec 06): PromptPay — แสดง QR เอง (confirmPromptPayPayment แบบ handleActions: false),
 * poll cart จน webhook สร้าง order (กฎข้อ 3) และหมดอายุหลัง 10 นาที → ยกเลิก session แล้วลองใหม่ได้
 */
const PromptPayPaymentButton = ({ cart, notReady, "data-testid": dataTestId }: Props) => {
  const stripe = useStripe()
  const [qr, setQr] = useState<Qr | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finishing = useRef(false)

  const session = cart.payment_collection?.payment_sessions?.find((s) => s.status === "pending")
  const clientSecret = session?.data?.client_secret as string | undefined

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    try {
      // cart ถูก complete โดย webhook แล้ว — complete ซ้ำได้ order เดิมแล้ว redirect ไปหน้า confirmed
      await placeOrder(cart.id)
    } catch (err) {
      finishing.current = false
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [cart.id])

  const showQr = async () => {
    if (!stripe || !clientSecret) return
    setSubmitting(true)
    setError(null)
    setExpired(false)

    // โหลดหน้าใหม่ระหว่างรอ: PaymentIntent ยังรอสแกนอยู่ → ใช้ QR เดิม ไม่ confirm ซ้ำ
    const current = await stripe.retrievePaymentIntent(clientSecret)
    let intent = current.paymentIntent
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

    if (intent?.status === "succeeded") {
      return finish()
    }
    const image = promptPayQrImage(intent)
    if (!image) {
      setError("Could not create the PromptPay QR code. Please try again.")
      return
    }
    setNow(Date.now())
    setQr({ image, deadline: Date.now() + PROMPTPAY_TIMEOUT_MS })
  }

  const expire = useCallback(async () => {
    setQr(null)
    setExpired(true)
    // สร้าง session ใหม่ = Medusa ลบ session เดิม → Stripe provider cancel PaymentIntent เดิม (cart ยังอยู่)
    await initiatePaymentSession(cart, { provider_id: session!.provider_id }).catch((err) =>
      setError(err instanceof Error ? err.message : String(err))
    )
  }, [cart, session])

  // นับถอยหลัง → ครบ 10 นาทียกเลิก session
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

  // poll สถานะจน webhook complete cart
  useEffect(() => {
    if (!qr) return
    const timer = setInterval(async () => {
      const state = await getPromptPayState(cart.id)
      if (state === "paid") {
        clearInterval(timer)
        finish()
      } else if (state === "failed") {
        clearInterval(timer)
        setQr(null)
        setError("PromptPay payment failed. Please try again.")
      }
    }, PROMPTPAY_POLL_MS)
    return () => clearInterval(timer)
  }, [qr, cart.id, finish])

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
