import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { CreateNotificationDTO, MedusaContainer } from "@medusajs/framework/types"
import {
  acquireLockStep,
  convertDraftOrderWorkflow,
  releaseLockStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import {
  type MembershipStatus,
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
async function loadMembership(container: MedusaContainer, id: string) {
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

export const expireGroupBuyMembershipPaymentWorkflow = createWorkflow(
  "expire-group-buy-membership-payment",
  function (input: MembershipPaymentInput) {
    const key = lockKey(input)
    acquireLockStep({ key, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })
    const result = expireMembershipPaymentStep(input)
    when("cancel-expired-group-buy-order", { result }, ({ result }) => result.members.length > 0).then(() => {
      cancelMemberOrdersStep(result.members)
      sendNotificationsStep(result.notifications)
    })
    releaseLockStep({ key })
    return new WorkflowResponse(result.members)
  }
)
