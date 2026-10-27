"use client"

import { RadioGroup } from "@headlessui/react"
import { paymentInfoMap } from "@lib/constants"
import { retrieveGroupBuyOrder } from "@lib/data/group-buy"
import { createPaymentSession } from "@lib/data/payment"
import { convertToLocale } from "@lib/util/money"
import {
  GroupBuyOrder,
  GroupBuyPaymentSession,
  hasPayment,
  orderPayView,
  payableCollection,
  sessionCreateOutcome,
} from "@lib/util/order-pay"
import { PROMPTPAY_POLL_MS, promptPayFallbackAllowed } from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import { StripePaymentContainer } from "@modules/checkout/components/payment-container"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import { StripeContext } from "@modules/checkout/components/payment-wrapper/stripe-wrapper"
import PromptPayOrderDelayed from "@modules/checkout/components/promptpay-payment/order-delayed"
import { Heading, Text } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { OrderCardButton } from "./pay-buttons"

const CARD = "pp_stripe_stripe"
const PAY_FAILED = "ชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

type Props = { initial: GroupBuyOrder; serverNow: number }

/** PAY-3b (spec 06 กฎข้อ 9): หน้าชำระเงินของ draft order กลุ่ม — สถานะจาก GB-8, สร้าง session ด้วย route ของ Medusa */
export default function OrderPay({ initial, serverNow }: Props) {
  const router = useRouter()
  const orderId = initial.order.id
  const [data, setData] = useState(initial)
  // เวลาของ server ตอน render แล้วใช้เวลาของ browser หลัง hydrate (ไม่ hydration mismatch)
  const [now, setNow] = useState(serverNow)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awaiting, setAwaiting] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  // PAY-6c: จำนวนการอ่าน GB-8 นับจากรู้ว่าชำระแล้ว — เพดาน PROMPTPAY_FALLBACK_MAX_REQUESTS (ข้อ d)
  const reads = useRef(0)

  const collection = payableCollection(data)
  const session = collection?.payment_sessions.find((s) => s.status === "pending")
  const [selected, setSelected] = useState(session?.provider_id ?? "")
  const view = orderPayView(data, now)

  // นาฬิกาของ browser: ครั้งแรกหลัง hydrate แล้วทุก 30 วินาที (เลยเส้นตายระหว่างเปิดหน้า → ปิดฟอร์ม)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const timer = setInterval(tick, 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [])

  const read = useCallback(async () => {
    const next = await retrieveGroupBuyOrder(orderId).catch(() => null)
    if (next) setData(next)
    return next
  }, [orderId])

  /** (d) ชำระแล้วแต่ยังไม่ captured → poll GB-8 อย่างเดียว (ไม่ complete cart) `used` = อ่านไปแล้วกี่ครั้ง */
  const awaitCapture = useCallback((used = 0) => {
    reads.current = used
    setError(null)
    setAwaiting(true)
  }, [])

  useEffect(() => {
    if (!awaiting) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (!promptPayFallbackAllowed(reads.current)) {
        setAwaiting(false)
        setDelayed(true)
        return
      }
      reads.current++
      const next = await read()
      if (!active) return
      // review #184: หยุดเมื่อ captured / collection completed เท่านั้น — authorized ยังรอต่อ
      if (next && orderPayView(next, Date.now()) === "paid") return setAwaiting(false)
      timer = setTimeout(tick, PROMPTPAY_POLL_MS)
    }
    timer = setTimeout(tick, PROMPTPAY_POLL_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [awaiting, read])

  /** (c) สร้าง/ต่อ session แล้วจัดการผลตามข้อ (d)/(d2) */
  const startSession = useCallback(
    async (providerId: string) => {
      if (!collection) return
      setBusy(true)
      setError(null)
      const res = await createPaymentSession(collection.id, providerId).catch(() => ({ status: 0, code: null }))
      const outcome = sessionCreateOutcome(res.status, res.code)
      if (outcome === "created") {
        if (!(await read())) setError(PAY_FAILED)
      } else if (outcome === "already-paid") {
        awaitCapture()
      } else if (outcome === "unauthorized") {
        // token หมดอายุ → layout ของ account แสดงหน้า login
        router.refresh()
      } else {
        // (d2) อ่าน GB-8 1 ครั้ง (นับรวมในเพดาน) แล้วตัดสินจากสถานะ ไม่ดู status code/ข้อความ — guard อาจแพ้ race กับ webhook
        const next = await read()
        if (next && hasPayment(next)) {
          if (orderPayView(next, Date.now()) !== "paid") awaitCapture(1)
        } else {
          setError(PAY_FAILED)
        }
      }
      setBusy(false)
    },
    [collection, read, awaitCapture, router]
  )

  const select = (providerId: string) => {
    setSelected(providerId)
    setCardReady(false)
    if (session?.provider_id !== providerId) startSession(providerId)
  }

  return (
    <div className="flex flex-col gap-y-6 w-full" data-testid="order-pay-page">
      <Heading level="h1" className="text-2xl-semi">
        ชำระเงินคำสั่งซื้อ #{data.order.display_id}
      </Heading>
      <div className="flex flex-col gap-y-1">
        {data.order.items.map((item) => (
          <Text key={item.id} className="txt-medium text-ui-fg-subtle">
            {item.title} × {item.quantity}
          </Text>
        ))}
        <Text className="txt-medium-plus text-ui-fg-base" data-testid="order-pay-total">
          ยอดชำระ {convertToLocale({ amount: data.order.total, currency_code: data.order.currency_code })}
        </Text>
      </div>
      {view === "paid" ? (
        <Text className="txt-medium-plus text-ui-fg-base" data-testid="order-pay-paid">
          ชำระเงินเรียบร้อยแล้ว ขอบคุณที่ร่วมซื้อกลุ่มกับเรา
        </Text>
      ) : delayed ? (
        <PromptPayOrderDelayed />
      ) : awaiting ? (
        <Text className="txt-medium-plus text-ui-fg-base" aria-live="polite" data-testid="order-pay-awaiting">
          ได้รับชำระเงินแล้ว กำลังยืนยันการชำระเงิน…
        </Text>
      ) : view === "waiting" ? (
        <Text className="txt-medium text-ui-fg-subtle" data-testid="order-pay-waiting">
          กลุ่มของคุณยังไม่สำเร็จ เมื่อกลุ่มครบเป้าหมายเราจะส่งอีเมลแจ้งให้ชำระเงิน
        </Text>
      ) : view === "closed" ? (
        <Text className="txt-medium text-ui-fg-subtle" data-testid="order-pay-closed">
          คำสั่งซื้อนี้ชำระเงินไม่ได้แล้ว เนื่องจากหมดเวลาชำระเงินหรือถูกยกเลิก
        </Text>
      ) : (
        <PaymentWrapper
          key={session?.data.client_secret ?? "none"}
          paymentSessions={session ? [session as unknown as HttpTypes.StorePaymentSession] : []}
        >
          <div className="flex flex-col gap-y-4" data-testid="order-pay-form">
            <RadioGroup value={selected} onChange={select} disabled={busy}>
              <StripePaymentContainer
                paymentProviderId={CARD}
                selectedPaymentOptionId={selected}
                paymentInfoMap={paymentInfoMap}
                setError={setError}
                setPaymentComplete={setCardReady}
              />
            </RadioGroup>
            <PayButton selected={selected} session={session} cardReady={cardReady} onPaid={awaitCapture} />
          </div>
        </PaymentWrapper>
      )}
      <ErrorMessage error={error} data-testid="order-pay-error" />
    </div>
  )
}

type PayButtonProps = {
  selected: string
  session: GroupBuyPaymentSession | undefined
  cardReady: boolean
  onPaid: () => void
}

/** ปุ่มชำระบัตร — ต้องมี session ของบัตรและ <Elements> (StripeContext) ก่อน (พร้อมเพย์: PAY-3b2) */
const PayButton = ({ selected, session, cardReady, onPaid }: PayButtonProps) => {
  const stripeReady = useContext(StripeContext)
  if (!stripeReady || selected !== CARD || session?.provider_id !== CARD) return null
  return <OrderCardButton ready={cardReady} onPaid={onPaid} />
}
