import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { LedgerEntry, selectMaturedEntryIds } from "../../modules/affiliate/utils/reversal"
import { reverseAffiliateCommissionWorkflow } from "./reverse-commission"

export type ApproveMaturedCommissionEntriesInput = { now: string; batch_size?: number }

const DEFAULT_BATCH_SIZE = 500

export const CANCEL_RECONCILED_LOG = "affiliate_cancel_reconciled"

/**
 * กฎ 30 (AF-10): ตาข่ายเมื่อ event order.canceled หาย — order ของ entry ที่กำลังจะ approve ที่ถูกยกเลิกแล้ว
 * → reverse ด้วย workflow เดียวกับ subscriber (lock `affiliate-attribution:<order_id>`, คิดส่วนต่างจาก ledger จึง idempotent)
 * คืน order ที่ห้าม approve ในรอบนี้ (ยกเลิกแล้วทั้งหมด รวมตัวที่ reverse ไม่สำเร็จ)
 */
const reconcileCanceledOrders = async (container: MedusaContainer, orderIds: string[]) => {
  if (!orderIds.length) {
    return new Set<string>()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    filters: { id: orderIds, status: "canceled" },
  })
  const canceled = new Set(data.map((o: { id: string }) => o.id))
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  for (const order_id of canceled) {
    const { result, errors } = await reverseAffiliateCommissionWorkflow(container).run({
      input: { order_id, reason: "canceled" },
      throwOnError: false,
    })
    if (errors?.length || !Array.isArray(result)) {
      logger.error(`affiliate-maturity: reversal of canceled order ${order_id} failed — entries stay pending`)
    } else if (result.length) {
      logger.warn(`${CANCEL_RECONCILED_LOG}: order ${order_id} reversed ${result.length} commission lines instead of approving`)
    }
  }
  return canceled
}

// pending ที่ matures_at <= now (index (status, matures_at)) และยอดสุทธิของ line > 0 (Q8) → approved
// ยกเว้น order ที่ยกเลิกแล้ว → reverse แทน (กฎ 30) — reversal เป็น ledger แบบ append-only (กฎ 5) จึงไม่มี compensation ที่ลบทิ้ง
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
      const candidates = selectMaturedEntryIds(
        matured as unknown as LedgerEntry[],
        reversals as unknown as LedgerEntry[]
      )
      const orderOf = new Map(matured.map((e) => [e.id, e.order_id]))
      const canceled = await reconcileCanceledOrders(container, [...new Set(candidates.map((id) => orderOf.get(id)!))])
      const ids = candidates.filter((id) => !canceled.has(orderOf.get(id)!))
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
