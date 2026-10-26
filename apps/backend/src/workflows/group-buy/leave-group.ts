import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { acquireLockStep, cancelOrderWorkflow, releaseLockStep } from "@medusajs/medusa/core-flows"
import { STORE_RESOURCE_NOT_FOUND } from "../../lib/store-ownership"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import type { RestoreGroupMembershipInput } from "../../modules/group_buy/service"
import { assertLeaveAllowed } from "../../modules/group_buy/utils/join"
import { ACTIVE_MEMBERSHIP_STATUSES, LOCK_TIMEOUT, LOCK_TTL } from "./join-group"

export type LeaveGroupInput = { membership_id: string; customer_id: string }

// ขั้น 0 (อ่านอย่างเดียว): หา group ของ membership เพื่อรู้ scope ของ lock — ไม่พบ → 404 (ADR-013)
// เจ้าของและสถานะตรวจซ้ำใต้ lock ในขั้นถัดไป
export const resolveLeaveTargetStep = createStep(
  "resolve-leave-target",
  async (input: LeaveGroupInput, { container }) => {
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const [membership] = await service.listGroupBuyMemberships(
      { id: input.membership_id },
      { select: ["id", "group_id"] }
    )
    if (!membership) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, STORE_RESOURCE_NOT_FOUND)
    }
    return new StepResponse({
      group_id: membership.group_id,
      lock: `group_buy:group:${membership.group_id}`,
    })
  }
)

// ขั้น 1 (ภายใต้ lock ของกลุ่ม): ตรวจกฎข้อ 13 แล้ว membership → cancelled + ตัวนับใน transaction เดียว (service)
// compensation: membership กลับเป็น joined และคืนตัวนับเดิมใน transaction เดียว
export const cancelGroupMembershipStep = createStep(
  "cancel-group-membership",
  async (input: LeaveGroupInput & { group_id: string }, { container }) => {
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const [membership] = await service.listGroupBuyMemberships(
      { id: input.membership_id },
      { select: ["id", "customer_id", "status"] }
    )
    const group = await service.retrieveGroupBuyGroup(input.group_id, { select: ["status"] })
    assertLeaveAllowed({ membership, group, customer_id: input.customer_id })

    const active = await service.listGroupBuyMemberships(
      { group_id: input.group_id, customer_id: input.customer_id, status: ACTIVE_MEMBERSHIP_STATUSES } as any,
      { select: ["id"] }
    )
    const { membership: cancelled, before } = await service.cancelGroupMembership({
      membership_id: input.membership_id,
      group_id: input.group_id,
      isLastMembership: active.every((m) => m.id === input.membership_id),
    })
    const undo: RestoreGroupMembershipInput = {
      membership_id: input.membership_id,
      group_id: input.group_id,
      before,
    }
    return new StepResponse(cancelled, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    await service.restoreGroupMembership(undo)
  }
)

// spec 04 leaveGroupWorkflow (กฎข้อ 13): ทีละ membership ภายใต้ lock `group_buy:group:<id>` (ADR-009);
// ยกเลิก draft order เป็นขั้นสุดท้ายเพราะย้อนกลับไม่ได้ — ล้ม → membership/ตัวนับถูกคืนและ lock ถูกปล่อย
export const leaveGroupWorkflow = createWorkflow("leave-group", function (input: LeaveGroupInput) {
  const target = resolveLeaveTargetStep(input)
  acquireLockStep({ key: target.lock, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL })

  const membership = cancelGroupMembershipStep(
    transform({ input, target }, ({ input, target }) => ({ ...input, group_id: target.group_id }))
  )
  cancelOrderWorkflow.runAsStep({
    input: transform({ membership }, ({ membership }) => ({ order_id: membership.order_id })),
  })

  releaseLockStep({ key: target.lock })
  return new WorkflowResponse(membership)
})
