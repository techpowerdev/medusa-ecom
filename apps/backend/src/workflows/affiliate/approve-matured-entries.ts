import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { LedgerEntry, selectMaturedEntryIds } from "../../modules/affiliate/utils/reversal"

export type ApproveMaturedCommissionEntriesInput = { now: string; batch_size?: number }

const DEFAULT_BATCH_SIZE = 500

// pending ที่ matures_at <= now (index (status, matures_at)) และยอดสุทธิของ line > 0 (Q8) → approved
// เปลี่ยนสถานะไปข้างหน้าอย่างเดียว (กฎ 5) selector status=pending ทำให้รันซ้ำ/พร้อมกันได้ผลเท่าเดิม
export const approveMaturedEntriesStep = createStep(
  "approve-matured-entries",
  async (input: ApproveMaturedCommissionEntriesInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const take = input.batch_size ?? DEFAULT_BATCH_SIZE
    const approved: string[] = []
    // แบ่ง batch ด้วย cursor id (entry ที่ไม่ผ่าน Q8 ยังเป็น pending จึงใช้ skip ไม่ได้)
    for (let after = ""; ; ) {
      const matured = await service.listAffiliateCommissionEntries(
        { status: "pending", matures_at: { $lte: new Date(input.now) }, ...(after ? { id: { $gt: after } } : {}) },
        { take, order: { id: "ASC" } }
      )
      if (!matured.length) {
        break
      }
      after = matured[matured.length - 1].id
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
        approved.push(...ids)
      }
      if (matured.length < take) {
        break
      }
    }
    return new StepResponse(approved)
  }
)

/** spec 05 scheduled job รายวัน (AF-4, AC-6) — รับ `now` เพื่อให้ test ควบคุมเวลาได้ */
export const approveMaturedCommissionEntriesWorkflow = createWorkflow(
  "approve-matured-commission-entries",
  function (input: ApproveMaturedCommissionEntriesInput) {
    return new WorkflowResponse(approveMaturedEntriesStep(input))
  }
)
