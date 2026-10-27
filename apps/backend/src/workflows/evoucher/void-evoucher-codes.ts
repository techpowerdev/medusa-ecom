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
import { planExpiringCodes } from "../../modules/evoucher/utils/expiry"
import { resolveEvoucherPoolInventoryStep } from "./import-evoucher-codes"

export const EXPIRING_VOID_REASON = "expiring"

export type VoidAvailableEvoucherCodesStepInput = {
  reason: string
  /** void code เดียว (admin) — ถ้า code ไม่ใช่ `available` → 409 */
  code_id?: string
  /** EV-12: void เฉพาะ code เหล่านี้ (job รายวัน — code ที่ไม่ได้เว้นไว้) */
  code_ids?: string[]
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
        ids: input.code_ids,
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
  /** ISO timestamp ของรอบ job (code ที่ expires_at <= now หมดอายุแล้ว — ไม่ถูกเว้น) */
  now: string
  expires_before: string
}

// EV-12 (กฎข้อ 12b a): `near` = code `available` ที่ expires_at < now + 7 วัน, `long` = available ที่เหลือ
export const listExpiringEvoucherCodesStep = createStep(
  "list-expiring-evoucher-codes",
  async (input: { pool_id: string; expires_before: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const near = await service.listEvoucherCodes(
      { pool_id: input.pool_id, status: "available", expires_at: { $lt: new Date(input.expires_before) } },
      { select: ["id", "expires_at"] }
    )
    const counts = await service.countCodesByStatus([input.pool_id])
    return new StepResponse({
      near: near.map((code) => ({ id: code.id, expires_at: code.expires_at!.toISOString() })),
      long: Math.max(0, counts[input.pool_id].available - near.length),
    })
  }
)

// EV-12 (กฎข้อ 12b a): stocked/reserved ของ inventory level ของ pool (อ่านอย่างเดียว ไม่ lock — Non-functional)
export const readEvoucherStockStep = createStep(
  "read-evoucher-stock",
  async (level: EvoucherStockLevel, { container }) => {
    const [row] = await container.resolve(Modules.INVENTORY).listInventoryLevels(level)
    return new StepResponse({
      ...level,
      stocked: MathBN.convert(row?.stocked_quantity ?? 0).toNumber(),
      reserved: MathBN.convert(row?.reserved_quantity ?? 0).toNumber(),
    })
  }
)

// AC-5, AC-30: job รายวัน (ทีละ pool) เว้น code ใกล้หมดอายุไว้เท่าที่ order ที่จองแล้วต้องใช้ (กฎข้อ 12b)
// แล้ว void ส่วนที่เหลือ (reason "expiring") และลด inventory เท่าจำนวนที่ void
export const voidExpiringEvoucherCodesWorkflow = createWorkflow(
  "void-expiring-evoucher-codes",
  function (input: VoidExpiringEvoucherCodesInput) {
    const candidates = listExpiringEvoucherCodesStep(input)

    // pool ที่ไม่มี code ใกล้หมดอายุไม่ต้องอ่าน inventory (pool ที่ตั้งค่าไม่ครบจึงไม่ log error ทุกวัน)
    const stock = when({ candidates }, ({ candidates }) => candidates.near.length > 0).then(() => {
      const level = resolveEvoucherPoolInventoryStep({ pool_id: input.pool_id })
      return readEvoucherStockStep(level)
    })

    const plan = transform({ input, candidates, stock }, ({ input, candidates, stock }) =>
      planExpiringCodes({
        now: new Date(input.now),
        near: candidates.near,
        long: candidates.long,
        reserved: stock?.reserved ?? 0,
      })
    )

    // void ยังเป็น UPDATE … WHERE status='available' — code ที่เพิ่งถูก claim ระหว่างนี้ไม่ถูก void
    const voidInput = transform({ input, plan }, ({ input, plan }) => ({
      pool_id: input.pool_id,
      expires_before: input.expires_before,
      code_ids: plan.void_ids,
      reason: EXPIRING_VOID_REASON,
    }))
    const voided = voidAvailableEvoucherCodesStep(voidInput)

    when({ voided }, ({ voided }) => voided.count > 0).then(() => {
      const adjustments = transform({ stock, voided }, ({ stock, voided }) => [
        { inventory_item_id: stock!.inventory_item_id, location_id: stock!.location_id, adjustment: -voided.count },
      ])
      adjustInventoryLevelsStep(adjustments)
    })

    const result = transform({ input, plan, stock, voided }, ({ input, plan, stock, voided }) => ({
      pool_id: input.pool_id,
      voided: voided.count,
      kept: plan.keep_ids.length,
      kept_earliest_expires_at: plan.kept_earliest_expires_at,
      // กฎข้อ 12b d: หลังรัน stocked < reserved → order ที่จองจะ backordered ตอน capture
      shortfall: stock ? Math.max(0, stock.reserved - (stock.stocked - voided.count)) : 0,
    }))
    return new WorkflowResponse(result)
  }
)
