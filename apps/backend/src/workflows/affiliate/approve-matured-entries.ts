import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { LedgerEntry, selectMaturedEntryIds } from "../../modules/affiliate/utils/reversal"

export type ApproveMaturedCommissionEntriesInput = { now: string }

// pending ที่ matures_at <= now (index (status, matures_at)) และยอดสุทธิของ line > 0 (Q8) → approved
// เปลี่ยนสถานะไปข้างหน้าอย่างเดียว (กฎ 5) selector status=pending ทำให้รันซ้ำ/พร้อมกันได้ผลเท่าเดิม
export const approveMaturedEntriesStep = createStep(
  "approve-matured-entries",
  async (input: ApproveMaturedCommissionEntriesInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const matured = await service.listAffiliateCommissionEntries({
      status: "pending",
      matures_at: { $lte: new Date(input.now) },
    })
    if (!matured.length) {
      return new StepResponse<string[]>([])
    }
    const reversals = await service.listAffiliateCommissionEntries({
      status: "reversed",
      order_id: [...new Set(matured.map((e) => e.order_id))],
    })
    const ids = selectMaturedEntryIds(
      matured as unknown as LedgerEntry[],
      reversals as unknown as LedgerEntry[]
    )
    if (ids.length) {
      await service.updateAffiliateCommissionEntries({
        selector: { id: ids, status: "pending" },
        data: { status: "approved" },
      })
    }
    return new StepResponse(ids)
  }
)

/** spec 05 scheduled job รายวัน (AF-4, AC-6) — รับ `now` เพื่อให้ test ควบคุมเวลาได้ */
export const approveMaturedCommissionEntriesWorkflow = createWorkflow(
  "approve-matured-commission-entries",
  function (input: ApproveMaturedCommissionEntriesInput) {
    return new WorkflowResponse(approveMaturedEntriesStep(input))
  }
)
