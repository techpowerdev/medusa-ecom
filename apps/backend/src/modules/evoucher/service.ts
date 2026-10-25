import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/knex"
import EvoucherPartner from "./models/evoucher-partner"
import EvoucherPool from "./models/evoucher-pool"
import EvoucherCode from "./models/evoucher-code"
import EvoucherCodeReveal from "./models/evoucher-code-reveal"
import {
  decryptSecret,
  encryptSecret,
  EncryptionKey,
  parseEncryptionKey,
} from "./utils/crypto"
import { EvoucherCodeCounts, StatusCountRow, toStatusCounts } from "./utils/stats"

export type EvoucherModuleOptions = {
  /** 64 hex chars จาก env `EVOUCHER_ENCRYPTION_KEY` */
  encryptionKey?: string
}

class EvoucherModuleService extends MedusaService({
  EvoucherPartner,
  EvoucherPool,
  EvoucherCode,
  EvoucherCodeReveal,
}) {
  protected readonly options_: EvoucherModuleOptions

  constructor(container: Record<string, unknown>, options: EvoucherModuleOptions = {}) {
    super(...arguments)
    this.options_ = options
  }

  // ตรวจ key ตอนใช้งาน (ไม่ใช่ตอน boot) เพื่อไม่ให้ app/test ที่ไม่ได้ใช้ e-voucher boot ไม่ขึ้น
  private key(): EncryptionKey {
    return parseEncryptionKey(this.options_.encryptionKey)
  }

  /** เรียกตั้งแต่ต้น workflow เพื่อล้มก่อนแตะข้อมูลถ้า EVOUCHER_ENCRYPTION_KEY ไม่ถูกต้อง */
  async assertEncryptionKey(): Promise<void> {
    this.key()
  }

  /** deterministic: code เดียวกันได้ ciphertext เดียวกัน → unique (pool_id, code) ที่ DB */
  async encryptCode(code: string): Promise<string> {
    return encryptSecret(code, this.key(), { deterministic: true })
  }

  async encryptPin(pin: string): Promise<string> {
    return encryptSecret(pin, this.key())
  }

  async decryptSecret(value: string): Promise<string> {
    return decryptSecret(value, this.key())
  }

  /** จำนวน code ต่อสถานะของแต่ละ pool (GROUP BY ใช้ index (pool_id, status); ไม่โหลดแถว code) */
  @InjectManager()
  async countCodesByStatus(
    poolIds: string[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<Record<string, EvoucherCodeCounts>> {
    if (!poolIds.length) {
      return {}
    }
    const rows = await sharedContext.manager!.execute<StatusCountRow[]>(
      `SELECT pool_id, status, count(*) AS count FROM evoucher_code
       WHERE pool_id IN (?) AND deleted_at IS NULL
       GROUP BY pool_id, status`,
      [poolIds]
    )
    return toStatusCounts(poolIds, rows)
  }

  /**
   * EV-5: void code ที่ยัง `available` แบบ atomic (conditional UPDATE เดียว) — code ที่ถูก allocate
   * ไปพร้อมกัน (EV-4 ใช้ FOR UPDATE SKIP LOCKED) จะไม่ถูก void ทับ คืนเฉพาะแถวที่ void จริง
   */
  @InjectManager()
  async voidAvailableCodes(
    filter: VoidAvailableCodesFilter,
    reason: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<{ id: string; pool_id: string }[]> {
    return await this.voidAvailableCodes_(filter, reason, sharedContext)
  }

  // mutation อยู่ใน transaction (convention ของ Medusa; สอดคล้องกับ allocate ของ EV-4)
  @InjectTransactionManager()
  protected async voidAvailableCodes_(
    filter: VoidAvailableCodesFilter,
    reason: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<{ id: string; pool_id: string }[]> {
    const conditions = [`deleted_at IS NULL`, `status = 'available'`]
    const params: unknown[] = [reason]
    if (filter.id) {
      conditions.push(`id = ?`)
      params.push(filter.id)
    }
    if (filter.pool_id) {
      conditions.push(`pool_id = ?`)
      params.push(filter.pool_id)
    }
    if (filter.expires_before) {
      conditions.push(`expires_at < ?`)
      params.push(filter.expires_before)
    }
    if (params.length === 1) {
      throw new MedusaError(MedusaError.Types.INVALID_ARGUMENT, "voidAvailableCodes requires a filter")
    }
    return await sharedContext.transactionManager!.execute<{ id: string; pool_id: string }[]>(
      `UPDATE evoucher_code SET status = 'void', void_reason = ?, updated_at = now()
       WHERE ${conditions.join(" AND ")}
       RETURNING id, pool_id`,
      params
    )
  }
  /**
   * EV-4: claim code ให้ voucher line item ของ order แบบ atomic (spec 02 Workflows, AC-4, AC-7)
   * - advisory lock ต่อ order: event ซ้ำที่รันพร้อมกันจะไม่ allocate line item เดียวกันสองครั้ง
   * - line item ที่มี code แล้ว (allocated/delivered) → skipped
   * - เลือก code `available` ที่ expires_at > expires_after (หรือไม่มีวันหมดอายุ) ตามวันหมดอายุก่อน
   *   ด้วย FOR UPDATE SKIP LOCKED: order อื่นที่ claim พร้อมกันข้ามแถวที่ล็อกอยู่ และ void ของ EV-5
   *   (conditional UPDATE) รอแล้วไม่ทับแถวที่ถูก allocate ไปแล้ว
   * - code ไม่พอสำหรับ quantity ของ line item → backordered ทั้ง line item (ไม่ claim บางส่วน)
   */
  @InjectManager()
  async claimCodesForOrder(
    input: ClaimCodesForOrderInput,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<ClaimCodesForOrderResult> {
    return await this.claimCodesForOrder_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async claimCodesForOrder_(
    input: ClaimCodesForOrderInput,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<ClaimCodesForOrderResult> {
    const result: ClaimCodesForOrderResult = { allocated: [], backordered: [], skipped: [] }
    if (!input.items.length) {
      return result
    }
    const manager = sharedContext.transactionManager!
    await manager.execute(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `evoucher-claim:${input.order_id}`,
    ])
    const existing = await manager.execute<{ order_line_item_id: string }[]>(
      `SELECT DISTINCT order_line_item_id FROM evoucher_code
       WHERE order_id = ? AND deleted_at IS NULL AND status IN ('allocated', 'delivered')`,
      [input.order_id]
    )
    const done = new Set(existing.map((row) => row.order_line_item_id))

    for (const item of input.items) {
      if (done.has(item.line_item_id)) {
        result.skipped.push(item.line_item_id)
        continue
      }
      const rows = await manager.execute<{ id: string }[]>(
        `SELECT id FROM evoucher_code
         WHERE pool_id = ? AND status = 'available' AND deleted_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY expires_at ASC NULLS LAST, id
         LIMIT ?
         FOR UPDATE SKIP LOCKED`,
        [item.pool_id, input.expires_after, item.quantity]
      )
      if (rows.length < item.quantity) {
        result.backordered.push(item.line_item_id)
        continue
      }
      const claimed = await manager.execute<{ id: string }[]>(
        `UPDATE evoucher_code
         SET status = 'allocated', order_id = ?, order_line_item_id = ?, customer_id = ?,
             allocated_at = now(), updated_at = now()
         WHERE id IN (?)
         RETURNING id`,
        [input.order_id, item.line_item_id, input.customer_id ?? null, rows.map((row) => row.id)]
      )
      result.allocated.push({ line_item_id: item.line_item_id, code_ids: claimed.map((row) => row.id) })
    }
    return result
  }
}

export type ClaimCodesForOrderInput = {
  order_id: string
  customer_id?: string | null
  items: { line_item_id: string; pool_id: string; quantity: number }[]
  /** ไม่เลือก code ที่หมดอายุก่อนเวลานี้ (กฎข้อ 2: now + 7 วัน) */
  expires_after: Date
}

export type ClaimCodesForOrderResult = {
  allocated: { line_item_id: string; code_ids: string[] }[]
  backordered: string[]
  skipped: string[]
}

export type VoidAvailableCodesFilter = {
  id?: string
  pool_id?: string
  expires_before?: Date
}

export default EvoucherModuleService
