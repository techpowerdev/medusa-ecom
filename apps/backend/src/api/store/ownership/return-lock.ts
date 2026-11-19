import { randomUUID } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { Logger } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

// CORE-56 (spec 01 กฎข้อ 114, Q-C6 = ก): createAndCompleteReturnOrderWorkflow ของ Medusa 2.22.1 ไม่มี lock —
// สอง request ของ order เดียวกันอ่าน return_requested_quantity เดิมพร้อมกันแล้วผ่านทั้งคู่ (return ซ้ำจากสองแท็บ)
// ทำให้ request ของ order เดียวกันวิ่งทีละตัวด้วย Locking module (provider Redis ที่ตั้งไว้แล้ว) — ตัวที่ได้ lock ทีหลัง
// เห็นจำนวนใหม่แล้ว Order module ปฏิเสธเอง (400 invalid_data) ไม่แทน route ของ core
export const STORE_RETURN_LOCK_TTL_SECONDS = 60 // ≥ เวลาของ workflow; process ตายกลางทาง → lock หมดอายุเอง
export const STORE_RETURN_LOCK_WAIT_MS = 5000 // 114b
const RETRY_INTERVAL_MS = 100

export const storeReturnLockKey = (orderId: string) => `store-return:${orderId}`

// ข้อความที่ provider ของ Locking module (in-memory และ redis) throw เมื่อ key มีเจ้าของอื่นถืออยู่ (acquire แบบไม่รอคิว)
// — แบบเดียวกับ src/workflows/evoucher/steps/resend-evoucher-email.ts (ตรวจใหม่เมื่อ bump เวอร์ชัน)
const isLockHeldError = (error: unknown, key: string) =>
  error instanceof Error && error.message === `Failed to acquire lock for key "${key}"`

// ตัวสุดท้ายของ chain /store/returns (ต่อจาก assignStoreReturnLocation) — request ที่ไม่ผ่าน middleware ก่อนหน้าไม่ถือ lock (114d)
export async function lockStoreReturnOrder(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const body = req.validatedBody as { order_id?: string } | undefined
  if (!body?.order_id) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Return request was not validated")
  }

  const locking = req.scope.resolve(Modules.LOCKING)
  const key = storeReturnLockKey(body.order_id)
  const ownerId = randomUUID()
  const deadline = Date.now() + STORE_RETURN_LOCK_WAIT_MS
  // acquire ของ provider redis แบบ awaitQueue รอไม่มีกำหนด จึงลองซ้ำเองจนถึง deadline
  for (;;) {
    try {
      await locking.acquire(key, { ownerId, expire: STORE_RETURN_LOCK_TTL_SECONDS })
      break
    } catch (error) {
      if (!isLockHeldError(error, key)) {
        throw error // 114b: error ของ Redis/Locking ไม่ถูกกลบเป็น 409
      }
      if (Date.now() + RETRY_INTERVAL_MS > deadline) {
        throw new MedusaError(MedusaError.Types.CONFLICT, "A return for this order is already being requested")
      }
      await sleep(RETRY_INTERVAL_MS)
    }
  }

  // 114c: release ครั้งเดียวด้วย ownerId ของ request นี้ เมื่อ finish หรือ close (ตัวใดเกิดก่อน) หรือ handler ถัดไป throw
  let released = false
  const release = () => {
    if (released) {
      return
    }
    released = true
    locking.release(key, { ownerId }).catch((error: unknown) => {
      req.scope
        .resolve<Logger>(ContainerRegistrationKeys.LOGGER)
        .warn(`Failed to release store return lock for order ${body.order_id}: ${(error as Error)?.message}`)
    })
  }

  if (res.destroyed) {
    // client ตัดการเชื่อมต่อระหว่างรอ lock — ไม่สร้าง return
    release()
    return
  }
  res.once("finish", release)
  res.once("close", release)
  try {
    next()
  } catch (error) {
    release()
    throw error
  }
}
