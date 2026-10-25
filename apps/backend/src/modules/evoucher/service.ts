import {
  InjectManager,
  MedusaContext,
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
}

export default EvoucherModuleService
