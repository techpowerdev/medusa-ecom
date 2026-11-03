"use client"

import { GroupBuyPaymentSession } from "@lib/util/order-pay"
import { PROMPTPAY_POLL_MS, promptPayExpiryAction, secondsLeft } from "@lib/util/payment-session"
import ErrorMessage from "@modules/checkout/components/error-message"
import { openQr } from "@modules/checkout/components/promptpay-payment/open-qr"
import PromptPayQr from "@modules/checkout/components/promptpay-payment/qr-panel"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useCallback, useEffect, useState } from "react"

// PAY-3b (spec 06 กฎข้อ 9c): ปุ่มชำระของหน้า order — อยู่ใน <Elements> ของ PaymentWrapper เดิม ไม่ complete cart (order มีอยู่แล้ว)
// ชำระสำเร็จ → onPaid (poll GB-8 จน captured ตามข้อ d)

/** บัตร: confirm PaymentIntent ด้วย PaymentElement เดิมของ checkout (3DS → redirect กลับหน้านี้) */
export const OrderCardButton = ({ ready, onPaid }: { ready: boolean; onPaid: () => void }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      // review #189: return_url ไม่มี query เดิม — Stripe แนบ payment_intent/redirect_status เอง (กฎข้อ 9 d3)
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}` },
    })
    const status = result.paymentIntent?.status ?? result.error?.payment_intent?.status
    if (status && promptPayExpiryAction(status) === "keep-polling") return onPaid()
    if (status === "requires_capture") return onPaid()
    setError(result.error?.message ?? "ชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    setSubmitting(false)
  }

  return (
    <>
      <Button
        size="large"
        onClick={pay}
        isLoading={submitting}
        disabled={!ready || !stripe || !elements}
        data-testid="order-pay-card-button"
      >
        ชำระเงิน
      </Button>
      <ErrorMessage error={error} data-testid="order-pay-card-error" />
    </>
  )
}

type PromptPayProps = {
  session: GroupBuyPaymentSession
  email: string
  /** QR หมดอายุและ PI ยังไม่ชำระ → สร้าง session ใหม่ (ผล 409/error จัดการที่หน้าตามข้อ d/d2) */
  renew: () => void
  onPaid: () => void
  /** อ่าน GB-8 ระหว่างแสดง QR (รอผลก่อนรอบถัดไป) — ชำระแล้วหน้าเปลี่ยนเป็น awaiting/paid เอง */
  poll: () => Promise<void>
}

/** PAY-3b2 (กฎข้อ 9c): พร้อมเพย์ — ขั้นเปิด QR + QR เดิมของ checkout; poll GB-8 แทน cart */
export const OrderPromptPayButton = ({ session, email, renew, onPaid, poll }: PromptPayProps) => {
  const stripe = useStripe()
  const clientSecret = session.data.client_secret
  const [qr, setQr] = useState<{ image: string; deadline: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const expire = useCallback(async () => {
    setQr(null)
    // review PR #48: PI ชำระแล้ว/กำลังดำเนินการ → ห้ามสร้าง session ใหม่ (Medusa ลบ session เดิม → provider cancel PI)
    const current = stripe && clientSecret ? await stripe.retrievePaymentIntent(clientSecret) : null
    if (promptPayExpiryAction(current?.paymentIntent?.status) === "keep-polling") return onPaid()
    renew()
  }, [stripe, clientSecret, renew, onPaid])

  const showQr = async () => {
    if (!stripe || !clientSecret) return
    setSubmitting(true)
    setError(null)
    // review #203: network error ของ Stripe.js → ไม่ให้ปุ่มค้าง loading
    const step = await stripe
      .retrievePaymentIntent(clientSecret)
      .then((current) => openQr(stripe, clientSecret, email, current.paymentIntent))
      .catch(() => ({ kind: "error" as const, message: "ชำระด้วยพร้อมเพย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }))
      .finally(() => setSubmitting(false))
    if (step.kind === "paid") return onPaid()
    if (step.kind === "expired") return expire()
    if (step.kind === "error") return setError(step.message)
    setNow(Date.now())
    setQr({ image: step.image, deadline: step.deadline })
  }

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
    // setTimeout ต่อกัน (ไม่ใช่ setInterval) — GB-8 ตอบช้ากว่า PROMPTPAY_POLL_MS จะไม่ยิงซ้อน
    let active = true
    let pollTimer: ReturnType<typeof setTimeout>
    const tick = async () => {
      await poll()
      if (active) pollTimer = setTimeout(tick, PROMPTPAY_POLL_MS)
    }
    pollTimer = setTimeout(tick, PROMPTPAY_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
      clearTimeout(pollTimer)
    }
  }, [qr, expire, poll])

  if (qr) {
    return (
      <div className="flex flex-col items-start gap-y-3" data-testid="promptpay-panel">
        <PromptPayQr image={qr.image} deadline={qr.deadline} now={now} />
      </div>
    )
  }

  return (
    <>
      <Button
        size="large"
        onClick={showQr}
        isLoading={submitting}
        disabled={!stripe || !clientSecret}
        data-testid="order-pay-promptpay-button"
      >
        ชำระด้วยพร้อมเพย์
      </Button>
      <ErrorMessage error={error} data-testid="promptpay-payment-error-message" />
    </>
  )
}
