import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import type { ILockingModule, Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { LedgerEntry, selectMaturedEntryIds } from "../../modules/affiliate/utils/reversal"
import { REVERSAL_LOCK_TTL, reverseAffiliateCommissionWorkflow } from "./reverse-commission"

export type ApproveMaturedCommissionEntriesInput = { now: string; batch_size?: number }

const DEFAULT_BATCH_SIZE = 500

export const CANCEL_RECONCILED_LOG = "affiliate_cancel_reconciled"
export const CANCEL_RECONCILE_NOOP_LOG = "affiliate_cancel_reconcile_noop"
export const MATURITY_LOCK_SKIPPED_LOG = "affiliate_maturity_lock_skipped"
// กฎ 32a: รอ lock ไม่เกิน 5 วินาทีต่อ order (ไม่ใช่ 30 วินาทีของ subscriber) — ไม่ได้ → ข้ามไปรอบถัดไป
export const MATURITY_LOCK_TIMEOUT_MS = 5000
const LOCK_RETRY_INTERVAL_MS = 300

type ReconcileLogger = Pick<Logger, "error" | "warn" | "info">
type ReconcileRun = { result?: unknown; errors?: unknown[]; transaction?: { hasFinished(): boolean } }

/** กฎ 30 + 32b/c: log ผลการ reverse order ที่ยกเลิกแล้ว — ระดับ error/"failed" เฉพาะเมื่อ workflow ล้มจริง */
export const logCancelReconcile = (logger: ReconcileLogger, order_id: string, run: ReconcileRun) => {
  if (run.transaction && !run.transaction.hasFinished()) {
    logger.warn(
      `affiliate-maturity: reversal of canceled order ${order_id} not completed this run (workflow retrying in background) — entries stay pending`
    )
  } else if (run.errors?.length || !Array.isArray(run.result)) {
    logger.error(`affiliate-maturity: reversal of canceled order ${order_id} failed — entries stay pending`)
  } else if (run.result.length) {
    logger.warn(`${CANCEL_RECONCILED_LOG}: order ${order_id} reversed ${run.result.length} commission lines instead of approving`)
  } else {
    logger.info(`${CANCEL_RECONCILE_NOOP_LOG}: order ${order_id} is canceled with net commission <= 0 — no reversal, entries stay pending`)
  }
}

// กฎ 32a: ขอ lock แบบไม่รอคิวซ้ำทุก 300ms จนครบ timeout (แบบ acquireLockStep ของ Medusa)
const tryAcquire = async (locking: ILockingModule, key: string, ownerId: string) => {
  for (const until = Date.now() + MATURITY_LOCK_TIMEOUT_MS; ; ) {
    try {
      await locking.acquire(key, { ownerId, expire: REVERSAL_LOCK_TTL })
      return true
    } catch {
      if (Date.now() >= until) {
        return false
      }
    }
    await setTimeout(LOCK_RETRY_INTERVAL_MS)
  }
}

// กฎ 30 (AF-10): ตาข่ายเมื่อ event order.canceled หาย — หา order ที่ถูกยกเลิกแล้วเพื่อ reverse แทนการ approve
const canceledOrders = async (container: MedusaContainer, orderIds: string[]) => {
  if (!orderIds.length) {
    return new Set<string>()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    filters: { id: orderIds, status: "canceled" },
  })
  return new Set(data.map((o: { id: string }) => o.id))
}

/**
 * กฎ 30 + 32: ต่อ order ขอ lock `affiliate-attribution:<order_id>` (≤ 5 วินาที, ไม่ได้ → ข้าม คง pending)
 * - order ยกเลิกแล้ว (event order.canceled หาย) → reverse ด้วย workflow เดียวกับ subscriber โดยส่ง lock owner ต่อให้
 *   (workflow ขอ lock ซ้ำด้วย owner เดิมได้ทันที แล้วเป็นผู้ปล่อยเอง รวมถึงตอน retry แบบ async) — ไม่ approve
 * - order อื่น → approve entry ที่ผ่าน Q8 ใต้ lock แล้วปล่อย
 * คืน id ที่ approve แล้ว
 */
const processOrders = async (
  container: MedusaContainer,
  service: AffiliateModuleService,
  candidatesByOrder: Map<string, string[]>,
  canceled: Set<string>
) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const locking = container.resolve(Modules.LOCKING)
  const ownerId = `affiliate-maturity:${randomUUID()}`
  const approved: string[] = []
  for (const [order_id, ids] of candidatesByOrder) {
    if (!canceled.has(order_id) && !ids.length) {
      continue
    }
    const key = `affiliate-attribution:${order_id}`
    if (!(await tryAcquire(locking, key, ownerId))) {
      logger.warn(`${MATURITY_LOCK_SKIPPED_LOG}: order ${order_id} is locked by another run — entries stay pending until next run`)
      continue
    }
    if (canceled.has(order_id)) {
      const run = await reverseAffiliateCommissionWorkflow(container).run({
        input: { order_id, reason: "canceled", lock_owner_id: ownerId },
        throwOnError: false,
      })
      logCancelReconcile(logger, order_id, run)
      continue
    }
    try {
      await service.updateAffiliateCommissionEntries({
        selector: { id: ids, status: "pending" },
        data: { status: "approved" },
      })
      approved.push(...ids)
    } finally {
      await locking.release(key, { ownerId })
    }
  }
  return approved
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
      // order ที่ยกเลิกแล้วตรวจทุก order ของ entry ที่ครบกำหนด (รวมที่ยอดสุทธิ ≤ 0 → log noop ตามกฎ 32c)
      const candidatesByOrder = new Map<string, string[]>(matured.map((e) => [e.order_id, []]))
      const orderOf = new Map(matured.map((e) => [e.id, e.order_id]))
      for (const id of candidates) {
        candidatesByOrder.get(orderOf.get(id)!)!.push(id)
      }
      const canceled = await canceledOrders(container, [...candidatesByOrder.keys()])
      approved.push(...(await processOrders(container, service, candidatesByOrder, canceled)))
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
