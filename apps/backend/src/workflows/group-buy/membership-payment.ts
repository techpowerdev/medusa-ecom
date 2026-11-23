import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO, MedusaContainer } from "@medusajs/framework/types"
import {
  acquireLockStep,
  capturePaymentWorkflow,
  convertDraftOrderWorkflow,
  deletePaymentSessionsWorkflow,
  releaseLockStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import {
  convertedOrderAction,
  type MembershipPaymentCheckDecision,
  membershipPaymentCheckDecision,
  type MembershipStatus,
  type PaymentSessionCheck,
  paymentCapturedAction,
  shouldExpireMembershipPayment,
} from "../../modules/group_buy/utils/membership-payment"
import { EmailTemplates } from "../../modules/resend/templates"
import { cancelMemberOrdersStep } from "./group-outcome"
import { LOCK_TIMEOUT, LOCK_TTL } from "./join-group"

export type MembershipPaymentInput = { membership_id: string }
type Member = { id: string; order_id: string }
export type MembershipPaymentResult = {
  order_id: string
  membership_status: MembershipStatus
  action: ReturnType<typeof paymentCapturedAction>
  convert: boolean
}

const groupBuy = (container: MedusaContainer): GroupBuyModuleService => container.resolve(GROUP_BUY_MODULE)

// อ่านใต้ lock ของ membership: สถานะ, deadline ของกลุ่ม และสถานะ collection ของ order (read-only link, ADR-009)
// GB-9: subscriber ใช้อ่านสถานะใหม่ก่อนส่ง alert เงินค้าง (กฎข้อ 25 a)
export async function loadMembership(container: MedusaContainer, id: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "group_buy_membership",
    fields: [
      "id",
      "status",
      "order_id",
      "group.pay_deadline_at",
      "order.is_draft_order",
      "order.display_id",
      "order.email",
      "order.currency_code",
      "order.total",
      "order.payment_collections.status",
    ],
    filters: { id },
  })
  const m = data[0] as any
  return {
    ...m,
    status: m.status as MembershipStatus,
    collectionStatuses: (m.order?.payment_collections ?? []).filter(Boolean).map((c: any) => c.status as string),
  }
}

// payment.captured ↔ หมดเวลาชำระเงินแข่งกันได้เฉพาะ membership `awaiting_payment` → lock ต่อ membership พอ
// (succeed/fail/leave แตะเฉพาะ `joined` ใต้ lock ของกลุ่ม)
const lockKey = (input: MembershipPaymentInput) =>
  transform({ input }, ({ input }) => `group_buy:membership:${input.membership_id}`)

// spec 04: payment.captured → membership `paid` (idempotent ผ่านสถานะ) — compensation คืน `awaiting_payment` ถ้าแปลง order ล้ม
export const markMembershipPaidStep = createStep(
  "mark-membership-paid",
  async (input: MembershipPaymentInput, { container }): Promise<StepResponse<MembershipPaymentResult, string | null>> => {
    const m = await loadMembership(container, input.membership_id)
    const action = paymentCapturedAction(m.status, m.collectionStatuses)
    // orphan (เงินเข้าแต่ membership ไม่ได้รอชำระ) → subscriber ส่ง ops alert จาก action ที่คืนไป
    if (action !== "mark_paid") {
      return new StepResponse(
        { order_id: m.order_id as string, membership_status: m.status, action, convert: false },
        null
      )
    }
    await groupBuy(container).updateGroupBuyMemberships({ id: m.id, status: "paid" })
    return new StepResponse(
      { order_id: m.order_id as string, membership_status: m.status, action, convert: !!m.order?.is_draft_order },
      m.id as string
    )
  },
  async (id, { container }) => {
    if (id) {
      await groupBuy(container).updateGroupBuyMemberships({ id, status: "awaiting_payment" })
    }
  }
)

export const confirmGroupBuyMembershipPaymentWorkflow = createWorkflow(
  "confirm-group-buy-membership-payment",
  function (input: MembershipPaymentInput) {
    const key = lockKey(input)
    acquireLockStep({ key, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })
    const result = markMembershipPaidStep(input)
    // draft order → order ปกติด้วย workflow ของ Medusa (emit order.placed → อีเมลยืนยันคำสั่งซื้อเดิม)
    // ข้อควรรู้: workflow นี้จอง inventory (สต็อกไม่พอ = ล้ม → compensation คืน awaiting_payment แล้ว subscriber ส่ง ops alert)
    // และคำนวณ tax lines ใหม่ (updateOrderTaxLinesWorkflow) — ถ้า tax rate เปลี่ยนระหว่างรอชำระ total หลังแปลงจะไม่เท่ายอดที่ capture
    when("convert-group-buy-draft-order", { result }, ({ result }) => result.convert).then(() => {
      convertDraftOrderWorkflow.runAsStep({ input: { id: result.order_id } })
    })
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

// GB-10 กฎข้อ 26: ops แปลง draft order เอง → membership `paid` (idempotent ผ่านสถานะ) — compensation คืน `awaiting_payment`
export type ConvertedMembershipInput = MembershipPaymentInput & { order_id: string }
export type ConvertedMembershipResult = {
  membership_id: string
  membership_status: MembershipStatus
  action: ReturnType<typeof convertedOrderAction>
}

export const markConvertedMembershipPaidStep = createStep(
  "mark-converted-membership-paid",
  async (input: ConvertedMembershipInput, { container }) => {
    const m = await loadMembership(container, input.membership_id)
    // metadata ของ order ปกติมาจาก cart.metadata (ลูกค้าตั้งได้) → ต้องเป็น order ของ membership นี้จริง
    const action =
      m.order_id === input.order_id
        ? convertedOrderAction(m.status, !!m.order?.is_draft_order, m.collectionStatuses)
        : "noop"
    const result: ConvertedMembershipResult = { membership_id: m.id, membership_status: m.status, action }
    if (action !== "mark_paid") {
      return new StepResponse(result, null as string | null)
    }
    await groupBuy(container).updateGroupBuyMemberships({ id: m.id, status: "paid" })
    return new StepResponse(result, m.id as string | null)
  },
  async (id, { container }) => {
    if (id) {
      await groupBuy(container).updateGroupBuyMemberships({ id, status: "awaiting_payment" })
    }
  }
)

// lock ต่อ membership ตัวเดียวกับ GB-5 — order.placed ที่เกิดจากการแปลงใน confirm workflow มาหลัง lock นั้นถูกปล่อยแล้ว
export const markGroupBuyMembershipPaidOnConvertWorkflow = createWorkflow(
  "mark-group-buy-membership-paid-on-convert",
  function (input: ConvertedMembershipInput) {
    const key = lockKey(input)
    acquireLockStep({ key, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })
    const result = markConvertedMembershipPaidStep(input)
    releaseLockStep({ key })
    return new WorkflowResponse(result)
  }
)

// AC-10: หมดเวลาชำระเงิน → membership `cancelled` แล้วยกเลิก order (cancelMemberOrdersStep ของ GB-4) + อีเมล
export const expireMembershipPaymentStep = createStep(
  "expire-membership-payment",
  async (input: MembershipPaymentInput, { container }) => {
    const m = await loadMembership(container, input.membership_id)
    if (!shouldExpireMembershipPayment(m.status, m.group?.pay_deadline_at, new Date(), m.collectionStatuses)) {
      return new StepResponse({ members: [] as Member[], notifications: [] as CreateNotificationDTO[] }, null)
    }
    await groupBuy(container).updateGroupBuyMemberships({ id: m.id, status: "cancelled" })
    const { email, ...order } = m.order ?? {}
    const notifications: CreateNotificationDTO[] = email
      ? [
          {
            to: email,
            channel: "email",
            template: EmailTemplates.GROUP_BUY_PAYMENT_EXPIRED,
            data: {
              order: {
                id: m.order_id,
                display_id: order.display_id,
                currency_code: order.currency_code,
                total: order.total,
              },
            },
            trigger_type: "group_buy.membership.payment_expired",
            resource_id: m.order_id,
            resource_type: "order",
            idempotency_key: `${EmailTemplates.GROUP_BUY_PAYMENT_EXPIRED}-${m.id}`,
          },
        ]
      : []
    return new StepResponse({ members: [{ id: m.id, order_id: m.order_id }] as Member[], notifications }, m.id as string)
  },
  async (id, { container }) => {
    if (id) {
      await groupBuy(container).updateGroupBuyMemberships({ id, status: "awaiting_payment" })
    }
  }
)

// GB-20 กฎข้อ 43 (ADR-024 b): หลัง cancelOrderWorkflow (ตั้ง collection `canceled` ให้แล้ว) ลบ session ที่ยังไม่มี payment
// ผ่าน workflow ของ Medusa → provider deletePayment (Stripe cancel PI) ไม่ให้ PI เดิมจ่ายได้หลังสิทธิ์ถูกยกเลิก
// best-effort: ล้ม → warn แล้วไปต่อ (membership/order ยกเลิกแล้ว); ไม่เรียก cancelPaymentCollectionWorkflow (throw "already canceled")
export const GROUP_BUY_SESSION_CANCEL_FAILED = "GROUP_BUY_SESSION_CANCEL_FAILED"

export const deleteMemberPaymentSessionsStep = createStep(
  "delete-member-payment-sessions",
  async (members: Member[], { container }) => {
    const { data: orders } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payment_sessions.id",
        "payment_collections.payment_sessions.authorized_at",
        "payment_collections.payment_sessions.payment.id",
      ],
      filters: { id: members.map((m) => m.order_id) },
    })
    for (const order of orders as any[]) {
      const ids: string[] = (order.payment_collections ?? [])
        .flatMap((c: any) => c?.payment_sessions ?? [])
        .filter((s: any) => s && !s.authorized_at && !s.payment)
        .map((s: any) => s.id)
      // ทีละ id (review #429): ส่งหลาย id ในครั้งเดียวแล้วลบได้บางตัว → validateDeletedPaymentSessionsStep throw และ compensation
      // ของ Medusa สร้าง session ที่ลบแล้วขึ้นใหม่ (PI ใหม่) บน collection ที่ canceled
      for (const id of ids) {
        try {
          await deletePaymentSessionsWorkflow(container).run({ input: { ids: [id] } })
        } catch (error) {
          container
            .resolve(ContainerRegistrationKeys.LOGGER)
            .warn(
              `${GROUP_BUY_SESSION_CANCEL_FAILED} order=${order.id} sessions=${id}: ${(error as Error)?.message ?? error}`
            )
        }
      }
    }
    return new StepResponse(undefined)
  }
)

export const expireGroupBuyMembershipPaymentWorkflow = createWorkflow(
  "expire-group-buy-membership-payment",
  function (input: MembershipPaymentInput) {
    const key = lockKey(input)
    acquireLockStep({ key, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })
    const result = expireMembershipPaymentStep(input)
    when("cancel-expired-group-buy-order", { result }, ({ result }) => result.members.length > 0).then(() => {
      cancelMemberOrdersStep(result.members)
      deleteMemberPaymentSessionsStep(result.members)
      sendNotificationsStep(result.notifications)
    })
    releaseLockStep({ key })
    return new WorkflowResponse(result.members)
  }
)

// GB-20b กฎข้อ 50 (ADR-024 ภาคผนวก 2026-11-21): ก่อน job หมดเวลาชำระยกเลิก ตรวจทุก session ของ collection ที่ provider
// ด้วย paymentModule.authorizePaymentSession (ไม่ใช้ authorizePaymentSessionStep — กลืน error ของ provider และ compensation ยกเลิก payment)
export const GROUP_BUY_PAYMENT_CHECK_FAILED = "GROUP_BUY_PAYMENT_CHECK_FAILED"
export const GROUP_BUY_PAYMENT_CHECK_GAVE_UP = "GROUP_BUY_PAYMENT_CHECK_GAVE_UP"

type SessionCheck = PaymentSessionCheck & { session_id: string; payment_id?: string; error?: string }
export type MembershipPaymentCheckResult = {
  membership_id: string
  order_id: string | null
  pay_deadline_at: string | null
  decision: MembershipPaymentCheckDecision
  payment_id: string | null
  sessions: SessionCheck[]
}

async function checkSession(container: MedusaContainer, session: any): Promise<SessionCheck> {
  const payment = container.resolve(Modules.PAYMENT)
  const base = { session_id: session.id as string }
  try {
    // ไม่ส่ง shared context ของ step (review #440 nit 2): module เปิด manager เอง (@InjectManager ไม่ใช่ transaction)
    // การ update session ก่อน throw NOT_ALLOWED จึงไม่ถูก rollback และอ่านกลับได้ด้านล่าง
    const paid = await payment.authorizePaymentSession(session.id, {})
    return paid ? { ...base, outcome: "payment", existing: !!session.payment?.id, payment_id: paid.id } : { ...base, outcome: "pending" }
  } catch (error) {
    if (!(MedusaError.isMedusaError(error) && (error as MedusaError).type === MedusaError.Types.NOT_ALLOWED)) {
      return { ...base, outcome: "error", error: (error as Error)?.message ?? String(error) }
    }
  }
  try {
    const stored = await payment.retrievePaymentSession(session.id, { select: ["status", "data"] })
    return { ...base, outcome: "not_allowed", status: (stored.data as { status?: string } | null)?.status }
  } catch (error) {
    return { ...base, outcome: "error", error: (error as Error)?.message ?? String(error) }
  }
}

export const checkMembershipPaymentStep = createStep(
  "check-group-buy-membership-payment",
  async (input: MembershipPaymentInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "group_buy_membership",
      fields: [
        "id",
        "status",
        "order_id",
        "group.pay_deadline_at",
        "order.payment_collections.payment_sessions.id",
        "order.payment_collections.payment_sessions.payment.id",
      ],
      filters: { id: input.membership_id },
    })
    const m = data[0] as any
    const deadline = m?.group?.pay_deadline_at ? new Date(m.group.pay_deadline_at).toISOString() : null
    const result: MembershipPaymentCheckResult = {
      membership_id: input.membership_id,
      order_id: m?.order_id ?? null,
      pay_deadline_at: deadline,
      decision: "skip",
      payment_id: null,
      sessions: [],
    }
    // ตรวจซ้ำจาก snapshot ของ job: ไม่ได้รอชำระแล้ว (เช่น webhook ตั้ง paid) → ไม่เรียก provider
    if (m?.status !== "awaiting_payment" || !deadline) {
      return new StepResponse(result)
    }
    const sessions = (m.order?.payment_collections ?? [])
      .flatMap((c: any) => c?.payment_sessions ?? [])
      .filter(Boolean)
    for (const session of sessions) {
      result.sessions.push(await checkSession(container, session))
    }
    result.decision = membershipPaymentCheckDecision(result.sessions, deadline, new Date())
    const paid = result.sessions.filter((s) => s.outcome === "payment")
    result.payment_id = (paid.find((s) => s.outcome === "payment" && !s.existing) ?? paid[0])?.payment_id ?? null

    const detail = () =>
      `membership_id=${result.membership_id} order_id=${result.order_id} pay_deadline_at=${deadline} sessions=` +
      result.sessions
        .map((s) => `${s.session_id}:${s.outcome}${"status" in s && s.status ? `(${s.status})` : ""}${s.error ? `(${s.error})` : ""}`)
        .join(",")
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    if (result.decision === "retry") {
      logger.warn(`${GROUP_BUY_PAYMENT_CHECK_FAILED} ${detail()} — retry next run`)
    } else if (result.decision === "give_up") {
      logger.error(`${GROUP_BUY_PAYMENT_CHECK_GAVE_UP} ${detail()} — cancelling; check the PaymentIntent in Stripe (ADR-015 D)`)
    }
    return new StepResponse(result)
  }
)

// alert give-up ถึง OPS_ALERT_EMAIL แบบ best-effort: ไม่ตั้ง env → warn แล้วข้าม; ส่งล้ม → log error ไม่ทำให้ job ล้ม
export const alertPaymentCheckGaveUpStep = createStep(
  "alert-group-buy-payment-check-gave-up",
  async (result: MembershipPaymentCheckResult, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const to = process.env.OPS_ALERT_EMAIL?.trim()
    if (!to) {
      logger.warn(`${GROUP_BUY_PAYMENT_CHECK_GAVE_UP}: OPS_ALERT_EMAIL is not set — skipping the ops alert email`)
      return new StepResponse(undefined)
    }
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to,
        channel: "email",
        template: EmailTemplates.GROUP_BUY_PAYMENT_CHECK_GAVE_UP,
        data: {
          membership_id: result.membership_id,
          order_id: result.order_id,
          pay_deadline_at: result.pay_deadline_at,
          sessions: result.sessions.map((s) => s.session_id).join(", "),
          error: result.sessions.map((s) => s.error ?? ("status" in s ? s.status : undefined) ?? s.outcome).join("; "),
        },
        resource_id: result.order_id ?? undefined,
        resource_type: "order",
        idempotency_key: `${EmailTemplates.GROUP_BUY_PAYMENT_CHECK_GAVE_UP}-${result.membership_id}`,
      })
    } catch (error) {
      logger.error(`${GROUP_BUY_PAYMENT_CHECK_GAVE_UP}: OPS_ALERT_EMAIL send failed: ${(error as Error)?.message ?? error}`)
    }
    return new StepResponse(undefined)
  }
)

// paid → capturePaymentWorkflow ของ Medusa (idempotent เมื่อ captured_at มีแล้ว; emit payment.captured → GB-5 ตั้ง paid + แปลง order)
// job เรียก expire เฉพาะ unpaid/give_up
export const checkGroupBuyMembershipPaymentWorkflow = createWorkflow(
  "check-group-buy-membership-payment",
  function (input: MembershipPaymentInput) {
    const result = checkMembershipPaymentStep(input)
    const paymentId = transform({ result }, ({ result }) => result.payment_id as string)
    when("capture-group-buy-paid-session", { result }, ({ result }) => result.decision === "paid").then(() => {
      capturePaymentWorkflow
        .runAsStep({ input: { payment_id: paymentId } })
        .config({ name: "capture-group-buy-paid-payment" })
    })
    when("alert-group-buy-payment-check-gave-up", { result }, ({ result }) => result.decision === "give_up").then(() => {
      alertPaymentCheckGaveUpStep(result)
    })
    return new WorkflowResponse(result)
  }
)
