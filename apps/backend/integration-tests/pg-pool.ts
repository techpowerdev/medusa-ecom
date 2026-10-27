import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Pool = {
  numUsed: () => number
  numPendingAcquires: () => number
  numPendingCreates: () => number
}
type Knex = { client: { pool?: Pool }; destroy: () => Promise<unknown>; initialize: () => unknown }
type Container = { hasRegistration: (key: string) => boolean; resolve: (key: string) => unknown }

export type ReleaseOptions = {
  /** ระยะห่างการตรวจ pool */
  intervalMs?: number
  /** pool ต้องว่างต่อเนื่องนานเท่านี้ (subscriber อาจหยุดคำนวณระหว่าง query) */
  quietMs?: number
  /** เลิกรอหลังจากนี้ — ไม่ destroy เพื่อไม่ abort งานที่ค้าง */
  timeoutMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function isIdle(pool: Pool): boolean {
  return pool.numUsed() === 0 && pool.numPendingAcquires() === 0 && pool.numPendingCreates() === 0
}

/** รอจน pool ไม่มี connection ที่ใช้อยู่/รอ acquire/กำลังสร้าง ต่อเนื่อง quietMs; คืน false เมื่อหมดเวลา */
async function waitForQuietPool(pool: Pool, { intervalMs, quietMs, timeoutMs }: Required<ReleaseOptions>) {
  const deadline = Date.now() + timeoutMs
  let idleSince: number | null = null
  while (Date.now() < deadline) {
    if (isIdle(pool)) {
      idleSince ??= Date.now()
      if (Date.now() - idleSince >= quietMs) {
        return true
      }
    } else {
      idleSince = null
    }
    await sleep(intervalMs)
  }
  return false
}

/**
 * OPS-15: medusa-test-utils restore DB จาก template ก่อนทุก test โดย terminate ทุก backend ของ DB นั้น
 * connection ที่ว่างอยู่ใน pool ของ app จึงตายและ knex เตือนตอนหยิบมาใช้ครั้งถัดไป — ปิด pool เดิม
 * แล้วสร้าง pool ใหม่บน knex instance เดิมที่ module ทุกตัวอ้างถึง
 * ต้องรอ pool ว่างก่อน: subscriber (เช่น search ingestion ของ product.created) อาจยังรันเบื้องหลังหลัง test จบ
 * (afterEach ของ runner รอแค่ workflow) และ tarn Pool.destroy() จะ abort acquire ที่รออยู่ของมัน
 */
export async function releaseIdlePgConnections(
  container: Container,
  options: ReleaseOptions = {}
): Promise<void> {
  if (!container.hasRegistration(ContainerRegistrationKeys.PG_CONNECTION)) {
    return
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex
  const pool = knex.client.pool
  if (!pool) {
    return
  }
  const quiet = await waitForQuietPool(pool, {
    intervalMs: options.intervalMs ?? 10,
    quietMs: options.quietMs ?? 50,
    timeoutMs: options.timeoutMs ?? 5000,
  })
  if (!quiet) {
    return
  }
  await knex.destroy()
  knex.initialize()
}
