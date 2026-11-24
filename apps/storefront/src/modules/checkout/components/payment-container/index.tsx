import { Radio as RadioGroupOption } from "@headlessui/react"
import { Text, clx } from "@modules/common/components/ui"
import React, { useContext, useEffect, useRef, useState, type JSX } from "react"

import Radio from "@modules/common/components/radio"

import { isManual } from "@lib/constants"
import { intentIsTerminal } from "@lib/util/payment-session"
import SkeletonCardDetails from "@modules/skeletons/components/skeleton-card-details"
import { PaymentElement, useStripe } from "@stripe/react-stripe-js"
import PaymentTest from "../payment-test"
import { StripeContext } from "../payment-wrapper/stripe-wrapper"

type PaymentContainerProps = {
  paymentProviderId: string
  selectedPaymentOptionId: string | null
  disabled?: boolean
  paymentInfoMap: Record<string, { title: string; icon: JSX.Element }>
  children?: React.ReactNode
}

const PaymentContainer: React.FC<PaymentContainerProps> = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  children,
}) => {
  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <RadioGroupOption
      key={paymentProviderId}
      value={paymentProviderId}
      // PAY-16 (review #541): headless Radio ใช้ disabled ของ RadioGroup เฉพาะเมื่อ prop เป็น undefined — false จะทับ group
      disabled={disabled || undefined}
      data-testid={`payment-option-${paymentProviderId}`}
      className={clx(
        "flex flex-col gap-y-2 text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
        {
          "border-ui-border-interactive":
            selectedPaymentOptionId === paymentProviderId,
        }
      )}
    >
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-x-4">
          <Radio checked={selectedPaymentOptionId === paymentProviderId} />
          <Text className="text-base-regular">
            {paymentInfoMap[paymentProviderId]?.title || paymentProviderId}
          </Text>
          {isManual(paymentProviderId) && isDevelopment && (
            <PaymentTest className="hidden small:block" />
          )}
        </div>
        <span className="justify-self-end text-ui-fg-base">
          {paymentInfoMap[paymentProviderId]?.icon}
        </span>
      </div>
      {isManual(paymentProviderId) && isDevelopment && (
        <PaymentTest className="small:hidden text-[10px]" />
      )}
      {children}
    </RadioGroupOption>
  )
}

export default PaymentContainer

type StripeFieldsProps = {
  /** client secret ของ session ที่เลือกอยู่ (ไม่มี = ไม่ตรวจ ตามเดิม) */
  clientSecret?: string
  /** PAY-14 (spec 06 กฎข้อ 16 a): PI จบแล้ว หรือ Elements โหลดไม่ได้ → ผู้เรียกสร้าง session ใหม่ (ไม่ส่ง = แสดงข้อความไทย) */
  onStaleSession?: () => void
  setError: (error: string | null) => void
  setPaymentComplete: (complete: boolean) => void
}

/** PAY-14: ตรวจ PI ของ session ก่อน mount Payment Element — PI `succeeded`/`canceled` ไม่ mount (Stripe ขึ้น error "terminal state") */
const StripeCardFields = ({ clientSecret, onStaleSession, setError, setPaymentComplete }: StripeFieldsProps) => {
  const stripe = useStripe()
  const [liveSecret, setLiveSecret] = useState<string | null>(null)
  const stale = useRef(onStaleSession)
  useEffect(() => {
    stale.current = onStaleSession
  })

  useEffect(() => {
    if (!stripe || !clientSecret) return
    let active = true
    stripe.retrievePaymentIntent(clientSecret).then(
      ({ paymentIntent }) => {
        if (!active) return
        if (intentIsTerminal(paymentIntent?.status) && stale.current) stale.current()
        else setLiveSecret(clientSecret)
      },
      // อ่านสถานะไม่ได้ (network) → mount ตามเดิม; Elements ที่โหลดไม่ได้เข้าทาง onLoadError
      () => active && setLiveSecret(clientSecret)
    )
    return () => {
      active = false
    }
  }, [stripe, clientSecret])

  if (clientSecret && liveSecret !== clientSecret) return <SkeletonCardDetails />

  return (
    <div className="my-4 transition-all duration-150 ease-in-out">
      <Text className="txt-medium-plus text-ui-fg-base mb-1">
        กรอกข้อมูลการชำระเงิน:
      </Text>
      <PaymentElement
        options={{ layout: "accordion" }}
        onChange={(e) => {
          setError(null)
          setPaymentComplete(e.complete)
        }}
        // Without a handler Stripe.js reports a failed mount as an unhandled "payment Element loaderror".
        // PAY-14 (กฎข้อ 16 a/b): ไม่แสดงข้อความอังกฤษของ Stripe — สร้าง session ใหม่ (ล้มอีก → ข้อความไทยของผู้เรียก)
        onLoadError={() => {
          setPaymentComplete(false)
          if (stale.current) stale.current()
          else setError("โหลดวิธีชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
        }}
      />
    </div>
  )
}

export const StripePaymentContainer = ({
  paymentProviderId,
  selectedPaymentOptionId,
  paymentInfoMap,
  disabled = false,
  fieldsHidden = false,
  ...fields
}: Omit<PaymentContainerProps, "children"> &
  StripeFieldsProps & {
    /** PAY-16 (spec 06 กฎข้อ 18 c): ไม่ render ช่องบัตร/skeleton (session ที่เลือกใช้ไม่ได้และรอลูกค้าลองใหม่) */
    fieldsHidden?: boolean
  }) => {
  const stripeReady = useContext(StripeContext)

  return (
    <PaymentContainer
      paymentProviderId={paymentProviderId}
      selectedPaymentOptionId={selectedPaymentOptionId}
      paymentInfoMap={paymentInfoMap}
      disabled={disabled}
    >
      {selectedPaymentOptionId === paymentProviderId &&
        !fieldsHidden &&
        (stripeReady ? <StripeCardFields {...fields} /> : <SkeletonCardDetails />)}
    </PaymentContainer>
  )
}
