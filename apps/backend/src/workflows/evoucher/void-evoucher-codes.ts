import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MathBN, MedusaError, Modules } from "@medusajs/framework/utils"
import { adjustInventoryLevelsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import {
  EVOUCHER_CODE_NOT_AVAILABLE,
  EVOUCHER_CODE_RESERVED,
} from "../../modules/evoucher/errors"
import EvoucherModuleService from "../../modules/evoucher/service"
import { resolveEvoucherPoolInventoryStep } from "./import-evoucher-codes"

export const EXPIRING_VOID_REASON = "expiring"

export type VoidAvailableEvoucherCodesStepInput = {
  reason: string
  /** void code เดียว (admin) — ถ้า code ไม่ใช่ `available` → 409 */
  code_id?: string
  pool_id?: string
  /** ISO timestamp: void code ที่ expires_at < ค่านี้ (job รายวัน) */
  expires_before?: string
}

// กฎข้อ 1: void เฉพาะ code `available` แล้วผู้เรียกลด inventory ตามจำนวนที่ void จริง
export const voidAvailableEvoucherCodesStep = createStep(
  "void-available-evoucher-codes",
  async (input: VoidAvailableEvoucherCodesStepInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const voided = await service.voidAvailableCodes(
      {
        id: input.code_id,
        pool_id: input.pool_id,
        expires_before: input.expires_before ? new Date(input.expires_before) : undefined,
      },
      input.reason
    )
    if (input.code_id && !voided.length) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Evoucher code ${input.code_id} cannot be voided: only available codes can be voided`,
        EVOUCHER_CODE_NOT_AVAILABLE
      )
    }
    const ids = voided.map((row) => row.id)
    return new StepResponse({ ids, count: ids.length }, ids)
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherCodes(
      ids.map((id) => ({ id, status: "available" as const, void_reason: null }))
    )
  }
)

type EvoucherStockLevel = { inventory_item_id: string; location_id: string }

// กฎข้อ 12: admin void ต้องเหลือ stock ที่ไม่ถูกจองอย่างน้อย 1 — ไม่งั้น order ที่จองไว้กลายเป็น backordered
// ตรวจและลด stock ภายใต้ lock key เดียวกับ reserveInventoryStep/adjustInventoryLevelsStep ของ Medusa (inventory_item_id)
// จึง serialize กับ void พร้อมกันและ checkout ที่จองระหว่างนั้น (ห้ามครอบ adjustInventoryLevelsStep ด้วย lock เดียวกัน — deadlock)
export const voidEvoucherStockStep = createStep(
  "void-evoucher-stock",
  async (input: EvoucherStockLevel & { code_id: string }, { container }) => {
    const inventory = container.resolve(Modules.INVENTORY)
    const locking = container.resolve(Modules.LOCKING)
    await locking.execute([input.inventory_item_id], async () => {
      const [level] = await inventory.listInventoryLevels({
        inventory_item_id: input.inventory_item_id,
        location_id: input.location_id,
      })
      const free = MathBN.sub(level?.stocked_quantity ?? 0, level?.reserved_quantity ?? 0)
      if (MathBN.lt(free, 1)) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `Evoucher code ${input.code_id} cannot be voided: the remaining stock is reserved by orders`,
          EVOUCHER_CODE_RESERVED
        )
      }
      await inventory.adjustInventory(input.inventory_item_id, input.location_id, -1)
    })
    const level: EvoucherStockLevel = {
      inventory_item_id: input.inventory_item_id,
      location_id: input.location_id,
    }
    return new StepResponse(level, level)
  },
  async (level, { container }) => {
    if (!level) {
      return
    }
    const inventory = container.resolve(Modules.INVENTORY)
    await container
      .resolve(Modules.LOCKING)
      .execute([level.inventory_item_id], () =>
        inventory.adjustInventory(level.inventory_item_id, level.location_id, 1)
      )
  }
)

export type VoidEvoucherCodeInput = {
  code_id: string
  reason: string
}

// AC-10: admin void code `available` 1 code → inventory ของ variant −1
export const voidEvoucherCodeWorkflow = createWorkflow(
  "void-evoucher-code",
  function (input: VoidEvoucherCodeInput) {
    const { data: codes } = useQueryGraphStep({
      entity: "evoucher_code",
      fields: ["id", "pool_id"],
      filters: { id: input.code_id },
      options: { throwIfKeyNotFound: true },
    })
    const poolId = transform({ codes }, ({ codes }) => codes[0].pool_id as string)
    const level = resolveEvoucherPoolInventoryStep({ pool_id: poolId })

    // ลำดับ: void code ก่อน (409 NOT_AVAILABLE) แล้วตรวจ+ลด stock ใต้ lock — ถ้า RESERVED compensation คืน code เป็น available
    voidAvailableEvoucherCodesStep({ code_id: input.code_id, reason: input.reason })

    const stock = transform({ level, input }, ({ level, input }) => ({ ...level, code_id: input.code_id }))
    voidEvoucherStockStep(stock)

    return new WorkflowResponse({ id: input.code_id })
  }
)

export type VoidExpiringEvoucherCodesInput = {
  pool_id: string
  expires_before: string
}

// AC-5: job รายวัน (ทีละ pool) void code `available` ที่ใกล้หมดอายุ (reason "expiring") แล้วลด inventory
export const voidExpiringEvoucherCodesWorkflow = createWorkflow(
  "void-expiring-evoucher-codes",
  function (input: VoidExpiringEvoucherCodesInput) {
    const voided = voidAvailableEvoucherCodesStep({
      pool_id: input.pool_id,
      expires_before: input.expires_before,
      reason: EXPIRING_VOID_REASON,
    })

    when({ voided }, ({ voided }) => voided.count > 0).then(() => {
      const level = resolveEvoucherPoolInventoryStep({ pool_id: input.pool_id })
      const adjustments = transform({ level, voided }, ({ level, voided }) => [
        { ...level, adjustment: -voided.count },
      ])
      adjustInventoryLevelsStep(adjustments)
    })

    const result = transform({ input, voided }, ({ input, voided }) => ({
      pool_id: input.pool_id,
      voided: voided.count,
    }))
    return new WorkflowResponse(result)
  }
)
