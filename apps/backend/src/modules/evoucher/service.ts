import { MedusaService } from "@medusajs/framework/utils"
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
}

export default EvoucherModuleService
