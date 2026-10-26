import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MathBN, MedusaError } from "@medusajs/framework/utils"
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

// กฎข้อ 12: admin void ต้องเหลือ stock ที่ไม่ถูกจองอย่างน้อย 1 — ไม่งั้น order ที่จองไว้กลายเป็น backordered
// (code ที่ไม่ใช่ `available` ข้ามไปให้ขั้น void ตอบ EVOUCHER_CODE_NOT_AVAILABLE)
export const assertEvoucherStockUnreservedStep = createStep(
  "assert-evoucher-stock-unreserved",
  async (
    input: { code_id: string; status: string; inventory_item_id: string; location_id: string },
    { container }
  ) => {
    if (input.status !== "available") {
      return new StepResponse(undefined)
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "inventory_level",
      fields: ["stocked_quantity", "reserved_quantity"],
      filters: { inventory_item_id: input.inventory_item_id, location_id: input.location_id },
    })
    const free = MathBN.sub(data[0]?.stocked_quantity ?? 0, data[0]?.reserved_quantity ?? 0)
    if (MathBN.lt(free, 1)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Evoucher code ${input.code_id} cannot be voided: the remaining stock is reserved by orders`,
        EVOUCHER_CODE_RESERVED
      )
    }
    return new StepResponse(undefined)
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
      fields: ["id", "pool_id", "status"],
      filters: { id: input.code_id },
      options: { throwIfKeyNotFound: true },
    })
    const poolId = transform({ codes }, ({ codes }) => codes[0].pool_id as string)
    const level = resolveEvoucherPoolInventoryStep({ pool_id: poolId })
    const check = transform({ codes, level }, ({ codes, level }) => ({
      ...level,
      code_id: codes[0].id as string,
      status: codes[0].status as string,
    }))
    assertEvoucherStockUnreservedStep(check)

    voidAvailableEvoucherCodesStep({ code_id: input.code_id, reason: input.reason })

    const adjustments = transform({ level }, ({ level }) => [{ ...level, adjustment: -1 }])
    adjustInventoryLevelsStep(adjustments)

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
