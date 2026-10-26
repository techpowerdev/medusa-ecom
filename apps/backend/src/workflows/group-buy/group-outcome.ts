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
  cancelOrderWorkflow,
  createOrderPaymentCollectionWorkflow,
  releaseLockStep,
  sendNotificationsStep,
} from "@medusajs/medusa/core-flows"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import { GB_DEADLINE_OUTCOME_CHANGED } from "../../modules/group_buy/errors"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import {
  expiredGroupOutcome,
  type GroupOutcome,
  payDeadlineAt,
  resolveGroupOutcomeTransition,
} from "../../modules/group_buy/utils/group-outcome"
import { EmailTemplates } from "../../modules/resend/templates"
import { LOCK_TIMEOUT, LOCK_TTL } from "./join-group"

// at_deadline: ส่งจาก deadline job เท่านั้น — ตรวจเป้าหมายซ้ำใต้ lock (admin override ไม่ส่ง)
export type GroupOutcomeInput = { group_id: string; at_deadline?: boolean }
type Member = { id: string; order_id: string }
type MembershipStatus = "joined" | "awaiting_payment" | "cancelled"

const groupBuy = (container: MedusaContainer): GroupBuyModuleService => container.resolve(GROUP_BUY_MODULE)

const ordersById = async (container: MedusaContainer, ids: string[], fields: string[]) => {
  const { data } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({ entity: "order", fields: ["id", ...fields], filters: { id: ids } })
  return data as any[]
}

// ตั้งผลของกลุ่ม (กฎข้อ 8: ครั้งเดียว, ผลเดิมซ้ำ = no-op) แล้วคืน membership `joined` ที่ยังต้องประมวลผล —
// รันซ้ำหลังล้มกลางทางจึงทำต่อจากที่ค้างได้ compensation: คืนสถานะ/เวลาเดิมของกลุ่ม
export const setGroupOutcomeStep = createStep(
  "set-group-outcome",
  async (input: GroupOutcomeInput & { outcome: GroupOutcome }, { container }) => {
    const service = groupBuy(container)
    const [group] = await service.listGroupBuyGroups(
      { id: input.group_id },
      {
        select: [
          "id",
          "status",
          "succeeded_at",
          "pay_deadline_at",
          "progress_orders",
          "progress_units",
          "progress_people",
        ],
        relations: ["campaign"],
      }
    )
    if (!group) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Group buy group with id: ${input.group_id} was not found`
      )
    }
    const members: Member[] = (
      await service.listGroupBuyMemberships(
        { group_id: group.id, status: "joined" },
        { select: ["id", "order_id"] }
      )
    ).map((m) => ({ id: m.id, order_id: m.order_id }))

    if (resolveGroupOutcomeTransition(group.status, input.outcome) === "noop") {
      return new StepResponse({ members, pay_deadline_at: group.pay_deadline_at }, null)
    }
    // review #89: job เลือกผลจาก progress ที่อ่านนอก lock — join/leave ที่ commit ระหว่างรอ lock อาจเปลี่ยนผล
    // ตัดสินใหม่จากแถวที่อ่านใต้ lock; ไม่ตรง → ไม่ทำอะไร (compensation release lock) job รอบถัดไปเลือกผลที่ถูก
    if (input.at_deadline && expiredGroupOutcome(group.campaign, group) !== input.outcome) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Group buy group ${group.id} no longer matches the ${input.outcome} outcome at its deadline`,
        GB_DEADLINE_OUTCOME_CHANGED
      )
    }
    const previous = {
      id: group.id,
      status: group.status,
      succeeded_at: group.succeeded_at,
      pay_deadline_at: group.pay_deadline_at,
    }
    const now = new Date()
    const patch =
      input.outcome === "succeeded"
        ? { succeeded_at: now, pay_deadline_at: payDeadlineAt(now, group.campaign.pay_within_hours) }
        : {}
    await service.updateGroupBuyGroups({ id: group.id, status: input.outcome, ...patch })
    return new StepResponse({ members, pay_deadline_at: patch.pay_deadline_at ?? null }, previous)
  },
  async (previous, { container }) => {
    if (previous) {
      await groupBuy(container).updateGroupBuyGroups(previous)
    }
  }
)

// payment collection บน draft order — ยอด = `total` ของ draft order ที่ Medusa คำนวณ (หลังส่วนลด GB-* ที่ freeze ตอน join)
// ไม่ใช้ summary.current_order_total (review #68) และไม่คำนวณยอดเอง; order ที่มี collection แล้วข้าม (AC-9)
// ถ้าล้มกลาง loop collection ที่สร้างแล้วใน step นี้ไม่ถูก compensate (Medusa ไม่รัน compensation ของ step ที่ throw)
// แต่รันซ้ำได้เพราะข้าม order ที่มี collection แล้ว
// ข้อจำกัด: ทุก membership ประมวลผลใน workflow เดียวใต้ lock (TTL 60s) — pool หลายร้อยคนอาจเกิน TTL
// (join ถูกปฏิเสธอยู่แล้วเพราะกลุ่มไม่ open)
export const createMemberPaymentCollectionsStep = createStep(
  "create-member-payment-collections",
  async (members: Member[], { container }) => {
    const orders = await ordersById(
      container,
      members.map((m) => m.order_id),
      ["total", "payment_collections.id"]
    )
    const created: { id: string; order_id: string }[] = []
    for (const order of orders.filter((o) => !o.payment_collections?.length)) {
      const { result } = await createOrderPaymentCollectionWorkflow(container).run({
        input: { order_id: order.id, amount: order.total },
      })
      created.push({ id: result[0].id, order_id: order.id })
    }
    return new StepResponse(created, created)
  },
  async (created, { container }) => {
    if (!created?.length) {
      return
    }
    await container.resolve(ContainerRegistrationKeys.LINK).dismiss(
      created.map((c) => ({
        [Modules.ORDER]: { order_id: c.order_id },
        [Modules.PAYMENT]: { payment_collection_id: c.id },
      }))
    )
    await container.resolve(Modules.PAYMENT).deletePaymentCollections(created.map((c) => c.id))
  }
)

export const setMembershipsStatusStep = createStep(
  "set-memberships-status",
  async (input: { members: Member[]; status: MembershipStatus }, { container }) => {
    const ids = input.members.map((m) => m.id)
    if (ids.length) {
      await groupBuy(container).updateGroupBuyMemberships(ids.map((id) => ({ id, status: input.status })))
    }
    return new StepResponse(undefined, ids)
  },
  async (ids, { container }) => {
    if (ids?.length) {
      await groupBuy(container).updateGroupBuyMemberships(
        ids.map((id) => ({ id, status: "joined" as const }))
      )
    }
  }
)

// ยกเลิก order (ย้อนกลับไม่ได้ จึงไม่มี compensation) — ถ้า step หลังจากนี้ (ส่งอีเมล) ล้ม กลุ่มกลับเป็น open
// และ membership กลับเป็น joined ขณะที่ order ถูกยกเลิกแล้ว: job รอบถัดไป fail ซ้ำได้เพราะ step นี้ข้าม order ที่ canceled แล้ว
export const cancelMemberOrdersStep = createStep(
  "cancel-member-orders",
  async (members: Member[], { container }) => {
    const orders = await ordersById(
      container,
      members.map((m) => m.order_id),
      ["status"]
    )
    for (const order of orders.filter((o) => o.status !== "canceled")) {
      await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })
    }
    return new StepResponse(undefined)
  }
)

// กฎข้อ 9: อีเมล "กลุ่มสำเร็จ" (ลิงก์ชำระเงิน + deadline) / "กลุ่มไม่สำเร็จ" — idempotency key ต่อ membership (AC-9)
export const buildGroupOutcomeNotificationsStep = createStep(
  "build-group-outcome-notifications",
  async (
    input: { members: Member[]; outcome: GroupOutcome; pay_deadline_at: Date | string | null },
    { container }
  ) => {
    const orders = await ordersById(
      container,
      input.members.map((m) => m.order_id),
      ["display_id", "email", "currency_code", "total"]
    )
    const byOrder = new Map(orders.map((o) => [o.id, o]))
    const storefront = (process.env.STOREFRONT_URL ?? "").replace(/\/$/, "")
    const template =
      input.outcome === "succeeded" ? EmailTemplates.GROUP_BUY_SUCCEEDED : EmailTemplates.GROUP_BUY_FAILED
    const notifications: CreateNotificationDTO[] = input.members
      .filter((m) => byOrder.get(m.order_id)?.email)
      .map((m) => {
        const { email, ...order } = byOrder.get(m.order_id)
        return {
          to: email,
          channel: "email",
          template,
          data: {
            order,
            ...(input.outcome === "succeeded" && {
              pay_url: `${storefront}/account/orders/${m.order_id}/pay`,
              pay_deadline_at: input.pay_deadline_at ? new Date(input.pay_deadline_at).toISOString() : null,
            }),
          },
          trigger_type: `group_buy.group.${input.outcome}`,
          resource_id: m.order_id,
          resource_type: "order",
          idempotency_key: `${template}-${m.id}`,
        }
      })
    return new StepResponse(notifications)
  }
)

const groupOutcomeWorkflow = (outcome: GroupOutcome) =>
  function (input: GroupOutcomeInput) {
    // lock เดียวกับ join/leave (ADR-009) — ไม่มี join/leave แทรกระหว่างตัดสินผลกับปรับ membership
    const lockKey = transform({ input }, ({ input }) => `group_buy:group:${input.group_id}`)
    acquireLockStep({ key: lockKey, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })

    const result = setGroupOutcomeStep(transform({ input }, ({ input }) => ({ ...input, outcome })))
    if (outcome === "succeeded") {
      createMemberPaymentCollectionsStep(result.members)
      setMembershipsStatusStep({ members: result.members, status: "awaiting_payment" })
    } else {
      setMembershipsStatusStep({ members: result.members, status: "cancelled" })
      cancelMemberOrdersStep(result.members)
    }

    const notifications = buildGroupOutcomeNotificationsStep({
      members: result.members,
      outcome,
      pay_deadline_at: result.pay_deadline_at,
    })
    when(
      `send-group-buy-${outcome}-emails`,
      { notifications },
      ({ notifications }) => notifications.length > 0
    ).then(() => {
      sendNotificationsStep(notifications)
    })

    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(result)
  }

// spec 04: event `group_buy.group.succeeded`, deadline job และ admin override
export const succeedGroupWorkflow = createWorkflow("succeed-group", groupOutcomeWorkflow("succeeded"))
export const failGroupWorkflow = createWorkflow("fail-group", groupOutcomeWorkflow("failed"))
