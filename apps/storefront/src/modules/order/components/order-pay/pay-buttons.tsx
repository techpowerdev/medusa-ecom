"use client"

import { promptPayExpiryAction } from "@lib/util/payment-session"
import ErrorMessage from "@modules/checkout/components/error-message"
import { Button } from "@modules/common/components/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import { useState } from "react"

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
      confirmParams: { return_url: window.location.href },
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
