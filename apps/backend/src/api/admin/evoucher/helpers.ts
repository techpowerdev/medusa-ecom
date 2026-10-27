import EvoucherModuleService from "../../../modules/evoucher/service"
import { maskSecret } from "../../../modules/evoucher/utils/mask"
import { isLowStock } from "../../../modules/evoucher/utils/stats"

type PoolRow = { id: string; low_stock_threshold: number }

// EV-9 (AC-15): field ที่ withCodeCounts ต้องใช้ — route เติมเองเสมอแม้ client ส่ง `fields` ที่ไม่มี
const POOL_COUNT_FIELDS = ["id", "low_stock_threshold"]

/** fields ของ query.graph สำหรับ pool: ของ client (หรือ default) + field ที่ใช้คำนวณ `code_counts`/`low_stock` */
export const withPoolCountFields = (fields: string[] = []) => [
  ...new Set([...fields, ...POOL_COUNT_FIELDS]),
]

/** เติม `code_counts` (ต่อสถานะ) และ `low_stock` ให้ pool สำหรับหน้า admin (EV-6) */
export async function withCodeCounts<T extends PoolRow>(
  service: EvoucherModuleService,
  pools: T[]
) {
  const counts = await service.countCodesByStatus(pools.map((p) => p.id))
  return pools.map((pool) => ({
    ...pool,
    code_counts: counts[pool.id],
    low_stock: isLowStock(counts[pool.id].available, pool.low_stock_threshold),
  }))
}

type CodeRow = { code: string; pin?: string | null }

/** AC-8: แทน code ด้วยค่า masked และ pin ด้วย `has_pin` — ห้ามคืน ciphertext/plaintext */
export async function maskCodes<T extends CodeRow>(
  service: EvoucherModuleService,
  rows: T[]
) {
  return Promise.all(
    rows.map(async ({ code, pin, ...rest }) => ({
      ...rest,
      code: maskSecret(await service.decryptSecret(code)),
      has_pin: !!pin,
    }))
  )
}
