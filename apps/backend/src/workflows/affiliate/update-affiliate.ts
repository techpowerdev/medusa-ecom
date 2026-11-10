import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import { AFFILIATE_STATUS_CHANGED } from "../../modules/affiliate/errors"
import AffiliateModuleService from "../../modules/affiliate/service"

type AffiliateStatus = "pending" | "active" | "suspended"

// Admin approves/suspends (Q1) and fills payout_info (Q5); email/code are not editable in v1
export type UpdateAffiliateInput = {
  id: string
  status?: AffiliateStatus
  payout_info?: Record<string, unknown> | null
  /** AF-15 (spec 05 กฎ 39b): สถานะที่หน้า admin เห็น — ไม่ตรงสถานะปัจจุบัน → 409 AFFILIATE_STATUS_CHANGED */
  expected_status?: AffiliateStatus
}

// กฎ 39b: ตรวจ expected_status กับการอัปเดตอยู่ใต้ lock เดียวกันต่อ affiliate (ไม่อ่านแล้วเขียนแยกโดยไม่มี lock)
export const updateAffiliateStep = createStep(
  "update-affiliate",
  async ({ expected_status, ...input }: UpdateAffiliateInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const locking = container.resolve(Modules.LOCKING)
    const { affiliate, previous } = await locking.execute(`affiliate:${input.id}`, async () => {
      const { id, status, payout_info } = await service.retrieveAffiliate(input.id, {
        select: ["id", "status", "payout_info"],
      })
      if (expected_status && expected_status !== status) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `Affiliate status changed to ${status} (expected ${expected_status})`,
          AFFILIATE_STATUS_CHANGED
        )
      }
      return { affiliate: await service.updateAffiliates(input), previous: { id, status, payout_info } }
    })
    return new StepResponse(affiliate, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliates(previous)
  }
)

export const updateAffiliateWorkflow = createWorkflow(
  "update-affiliate",
  function (input: UpdateAffiliateInput) {
    return new WorkflowResponse(updateAffiliateStep(input))
  }
)
