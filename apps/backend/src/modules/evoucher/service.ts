import {
  InjectManager,
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
    return await sharedContext.manager!.execute<{ id: string; pool_id: string }[]>(
      `UPDATE evoucher_code SET status = 'void', void_reason = ?, updated_at = now()
       WHERE ${conditions.join(" AND ")}
       RETURNING id, pool_id`,
      params
    )
  }
}

export type VoidAvailableCodesFilter = {
  id?: string
  pool_id?: string
  expires_before?: Date
}

export default EvoucherModuleService
