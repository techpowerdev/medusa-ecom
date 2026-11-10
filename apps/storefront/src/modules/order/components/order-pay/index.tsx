"use client"

import { RadioGroup } from "@headlessui/react"
import { paymentInfoMap } from "@lib/constants"
import { retrieveGroupBuyOrder } from "@lib/data/group-buy"
import { startPaymentSession } from "@lib/data/payment"
import { settleAction } from "@lib/util/action-result"
import { SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import { convertToLocale } from "@lib/util/money"
import {
  GroupBuyOrder,
  GroupBuyPaymentSession,
  hasPayment,
  orderPayView,
  payableCollection,
  sessionCreateOutcome,
  StripeReturn,
} from "@lib/util/order-pay"
import { PROMPTPAY_POLL_MS, promptPayFallbackAllowed } from "@lib/util/payment-session"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, { StripePaymentContainer } from "@modules/checkout/components/payment-container"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import { StripeContext } from "@modules/checkout/components/payment-wrapper/stripe-wrapper"
import PromptPayOrderDelayed from "@modules/checkout/components/promptpay-payment/order-delayed"
import { Heading, Text } from "@modules/common/components/ui"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { OrderCardButton, OrderPromptPayButton } from "./pay-buttons"

const CARD = "pp_stripe_stripe"
const PROMPTPAY = "pp_stripe-promptpay_stripe"
const PAY_FAILED = "ชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/** `redirect` = ผลของ `stripeReturn` จาก query ที่ Stripe แนบมาตอนกลับหน้านี้ (กฎข้อ 9 d3) */
type Props = { initial: GroupBuyOrder; email: string; redirect: StripeReturn; serverNow: number }

/** PAY-3b (spec 06 กฎข้อ 9): หน้าชำระเงินของ draft order กลุ่ม — สถานะจาก GB-8, สร้าง session ด้วย route ของ Medusa */
export default function OrderPay({ initial, email, redirect, serverNow }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const orderId = initial.order.id
  const [data, setData] = useState(initial)
  // เวลาของ server ตอน render แล้วใช้เวลาของ browser หลัง hydrate (ไม่ hydration mismatch)
  const [now, setNow] = useState(serverNow)
  const [busy, setBusy] = useState(false)
  // (d3) กลับจาก redirect: succeeded/processing → poll GB-8 ทันทีโดยไม่แสดงฟอร์ม; failed → error + ฟอร์มตามข้อ (b)
  const [error, setError] = useState<string | null>(redirect === "failed" ? PAY_FAILED : null)
  const [awaiting, setAwaiting] = useState(redirect === "poll" && orderPayView(initial, serverNow) !== "paid")
  const [expired, setExpired] = useState(false)
  const [delayed, setDelayed] = useState(false)
  const [cardReady, setCardReady] = useState(false)
  // error ของ PaymentElement แยกจาก order-pay-error — onChange ของ element ล้างค่าตอน mount จะได้ไม่ลบ error ของข้อ d2
  const [elementError, setElementError] = useState<string | null>(null)
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

  // review #189: ลบ query ของ Stripe (reload ไม่เข้าทาง d3 ซ้ำ)
  useEffect(() => {
    if (redirect) router.replace(pathname, { scroll: false })
  }, [redirect, router, pathname])

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

  /**
   * (d2) ยังไม่ชำระ → error + ฟอร์มเดิมให้ลองใหม่: ล้างตัวเลือก เพราะ RadioGroup ไม่เรียก onChange เมื่อคลิกค่าเดิม
   * (qa #189 D-1: คลิกบัตรซ้ำแล้วไม่สร้าง session ใหม่)
   */
  const fail = useCallback(() => {
    setError(PAY_FAILED)
    setSelected("")
  }, [])

  /** (c) สร้าง/ต่อ session แล้วจัดการผลตามข้อ (d)/(d2) */
  const startSession = useCallback(
    async (providerId: string) => {
      if (!collection) return
      setBusy(true)
      setError(null)
      // CORE-4i-b (กฎข้อ 72): action ที่ reject เอง = failed → (d2)
      const outcome = sessionCreateOutcome(await settleAction(startPaymentSession(collection.id, providerId)))
      if (outcome === "created") {
        if (!(await read())) fail()
      } else if (outcome === "already-paid") {
        awaitCapture()
      } else if (outcome === "unauthorized") {
        // token หมดอายุ → layout ของ account แสดงหน้า login (ข้อความเดียวทั้งเว็บระหว่างรอ/ถ้ายังอยู่หน้านี้)
        setError(SIGN_IN_AGAIN_MESSAGE)
        router.refresh()
      } else {
        // (d2) อ่าน GB-8 1 ครั้ง (นับรวมในเพดาน) แล้วตัดสินจากสถานะ ไม่ดู status code/ข้อความ — guard อาจแพ้ race กับ webhook
        // (d3) read() คืน null เมื่ออ่าน GB-8 ล้มเอง → fail(): order-pay-error ไม่ poll ต่อ — ปลอดภัยเพราะถ้าเงินเข้าแล้ว
        // การลองใหม่ได้ 409 PAYMENT_ALREADY_COMPLETED จาก guard (PAY-6a) แล้วเข้าทาง (d) ไม่ตัดเงินซ้ำ
        const next = await read()
        if (next && hasPayment(next)) {
          if (orderPayView(next, Date.now()) !== "paid") awaitCapture(1)
        } else {
          fail()
        }
      }
      setBusy(false)
    },
    [collection, read, awaitCapture, router, fail]
  )

  const select = (providerId: string) => {
    setSelected(providerId)
    setCardReady(false)
    setElementError(null)
    setExpired(false)
    if (session?.provider_id !== providerId) startSession(providerId)
  }

  /**
   * poll GB-8 ระหว่างแสดง QR — อยู่ที่หน้า (ไม่ใช่ในปุ่ม) เพราะปุ่มถูก unmount เมื่อ session ไม่ pending แล้ว
   * review #203 B2: processPaymentWorkflow แยก authorize กับ capture → เจอ "มีการชำระแล้ว" ที่ยังไม่ captured ให้เข้าทาง (d)
   */
  const pollQr = useCallback(async () => {
    const next = await read()
    if (next && hasPayment(next) && orderPayView(next, Date.now()) !== "paid") awaitCapture(1)
  }, [read, awaitCapture])

  /** พร้อมเพย์หมดอายุ 10 นาทีและ PI ยังไม่ชำระ → session ใหม่ (Medusa ลบ session เดิม → provider cancel PI เดิม) */
  const renewPromptPay = useCallback(async () => {
    await startSession(PROMPTPAY)
    setExpired(true)
  }, [startSession])

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
                setError={setElementError}
                setPaymentComplete={setCardReady}
                disabled={busy}
              />
              <PaymentContainer
                paymentProviderId={PROMPTPAY}
                selectedPaymentOptionId={selected}
                paymentInfoMap={paymentInfoMap}
                disabled={busy}
              />
            </RadioGroup>
            <ErrorMessage error={elementError} data-testid="order-pay-element-error" />
            {expired && (
              <Text className="txt-medium text-ui-fg-subtle" data-testid="promptpay-expired">
                คิวอาร์โค้ดพร้อมเพย์หมดอายุแล้ว กดชำระด้วยพร้อมเพย์อีกครั้งเพื่อรับคิวอาร์โค้ดใหม่
              </Text>
            )}
            <PayButton
              selected={selected}
              session={session}
              email={email}
              cardReady={cardReady}
              onPaid={awaitCapture}
              renew={renewPromptPay}
              poll={pollQr}
            />
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
  email: string
  cardReady: boolean
  onPaid: () => void
  renew: () => void
  poll: () => Promise<void>
}

/** ปุ่มชำระตามวิธีที่เลือก — ต้องมี session ของวิธีนั้นและ <Elements> (StripeContext) ก่อน */
const PayButton = ({ selected, session, email, cardReady, onPaid, renew, poll }: PayButtonProps) => {
  const stripeReady = useContext(StripeContext)
  if (!stripeReady || !session || session.provider_id !== selected) return null
  if (selected === CARD) return <OrderCardButton ready={cardReady} onPaid={onPaid} />
  return <OrderPromptPayButton session={session} email={email} renew={renew} onPaid={onPaid} poll={poll} />
}
