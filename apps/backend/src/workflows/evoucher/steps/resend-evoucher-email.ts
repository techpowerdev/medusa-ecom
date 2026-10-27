import { randomUUID } from "node:crypto"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { CreateNotificationDTO } from "@medusajs/framework/types"
import { EVOUCHER_MODULE } from "../../../modules/evoucher"
import { EVOUCHER_RESEND_IN_PROGRESS } from "../../../modules/evoucher/errors"
import EvoucherModuleService, { ClaimCodesForOrderResult } from "../../../modules/evoucher/service"
import { EvoucherLine, EvoucherOrder } from "./evoucher-order"
import { shortError } from "./send-evoucher-delivered-notification"

// lock หมดอายุเองถ้า process ตายกลางทาง (ส่งอีเมลหนึ่งฉบับใช้เวลาไม่กี่วินาที)
const RESEND_LOCK_TTL = 60

type ResendLock = { key: string; owner_id: string }

/** lock ต่อ order แบบไม่รอ: resend ที่ยิงซ้อนกันได้ 409 แทนการส่งอีเมลซ้ำ; ล้มภายหลัง → compensation ปล่อย lock */
export const acquireEvoucherResendLockStep = createStep(
  "acquire-evoucher-resend-lock",
  async (input: { order_id: string }, { container }) => {
    const lock: ResendLock = { key: `evoucher-resend:${input.order_id}`, owner_id: randomUUID() }
    try {
      await container
        .resolve(Modules.LOCKING)
        .acquire(lock.key, { ownerId: lock.owner_id, expire: RESEND_LOCK_TTL })
    } catch {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "An e-voucher email resend for this order is already in progress",
        EVOUCHER_RESEND_IN_PROGRESS
      )
    }
    return new StepResponse(lock, lock)
  },
  async (lock, { container }) => {
    if (lock) {
      await container.resolve(Modules.LOCKING).release(lock.key, { ownerId: lock.owner_id })
    }
  }
)

export const releaseEvoucherResendLockStep = createStep(
  "release-evoucher-resend-lock",
  async (lock: ResendLock, { container }) => {
    await container.resolve(Modules.LOCKING).release(lock.key, { ownerId: lock.owner_id })
    return new StepResponse(undefined)
  }
)

const RESENDABLE = ["allocated", "delivered"]

/** order พร้อม code จาก link order ↔ evoucher_code (EV-9) */
export type EvoucherResendOrder = EvoucherOrder & {
  evoucher_codes?: ({
    id: string
    status: string
    order_line_item_id: string | null
    created_at: Date | string
    pool: { id: string; name: string }
  } | null)[] | null
}

/** code `delivered` + `allocated` (ส่งล้ม, กฎข้อ 17) ของ order จัดกลุ่มต่อ line item ในรูปเดียวกับ claim ของ EV-4 — ไม่ allocate ใหม่ */
export const resolveEvoucherResendCodesStep = createStep(
  "resolve-evoucher-resend-codes",
  async (input: { order: EvoucherResendOrder }) => {
    // EV-9: code มาจาก link (ไม่ filter order_id ผ่าน service) — กรองสถานะและเรียง created_at ASC เอง
    const codes = (input.order.evoucher_codes ?? [])
      .filter((code): code is NonNullable<typeof code> => !!code && RESENDABLE.includes(code.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    if (!codes.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Order ${input.order.id} has no delivered or allocated e-voucher codes to resend`
      )
    }
    const lines: EvoucherLine[] = []
    const allocated: ClaimCodesForOrderResult["allocated"] = []
    for (const code of codes) {
      const lineItemId = code.order_line_item_id!
      const index = allocated.findIndex((a) => a.line_item_id === lineItemId)
      if (index >= 0) {
        allocated[index].code_ids.push(code.id)
        lines[index].quantity += 1
        continue
      }
      const item = input.order.items?.find((i) => i?.id === lineItemId)
      allocated.push({ line_item_id: lineItemId, code_ids: [code.id] })
      lines.push({
        line_item_id: lineItemId,
        pool_id: code.pool.id,
        pool_name: code.pool.name,
        title: item?.title ?? code.pool.name,
        quantity: 1,
      })
    }
    return new StepResponse({ lines, allocated, code_ids: codes.map((c) => c.id) })
  }
)

/**
 * ส่งอีเมลซ้ำด้วย idempotency_key ใหม่ทุกครั้ง (กฎข้อ 19 — key เดิมที่ status=failure ทำให้ Notification module throw NOT_FOUND)
 * ส่งล้ม → throw (admin เห็น error, code คง `allocated`); สำเร็จ → code `allocated` ของ order เป็น `delivered` (กฎข้อ 17)
 */
export const sendEvoucherResendNotificationStep = createStep(
  "send-evoucher-resend-notification",
  async (
    input: { order: EvoucherOrder; notification: CreateNotificationDTO; code_ids: string[] },
    { container }
  ) => {
    try {
      await container.resolve(Modules.NOTIFICATION).createNotifications([
        { ...input.notification, idempotency_key: `evoucher-resend:${input.order.id}:${randomUUID()}` },
      ])
    } catch (error) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not send the e-voucher email: ${shortError(error)}`
      )
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherCodes({
      selector: { id: input.code_ids, status: "allocated" },
      data: { status: "delivered", delivered_at: new Date(), delivered_to_email: input.order.email ?? null },
    })
    return new StepResponse({ code_count: input.code_ids.length })
  }
)
