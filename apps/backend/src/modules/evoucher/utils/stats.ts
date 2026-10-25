export const EVOUCHER_CODE_STATUSES = ["available", "allocated", "delivered", "void"] as const
export type EvoucherCodeStatus = (typeof EVOUCHER_CODE_STATUSES)[number]
export type EvoucherCodeCounts = Record<EvoucherCodeStatus, number>

export type StatusCountRow = { pool_id: string; status: string; count: number | string }

/** แปลงผล `GROUP BY pool_id, status` เป็นจำนวนต่อสถานะของทุก pool ที่ขอ (สถานะที่ไม่มีแถว = 0) */
export function toStatusCounts(
  poolIds: string[],
  rows: StatusCountRow[]
): Record<string, EvoucherCodeCounts> {
  const result: Record<string, EvoucherCodeCounts> = {}
  for (const id of poolIds) {
    result[id] = { available: 0, allocated: 0, delivered: 0, void: 0 }
  }
  for (const row of rows) {
    const counts = result[row.pool_id]
    if (counts && row.status in counts) {
      counts[row.status as EvoucherCodeStatus] = Number(row.count)
    }
  }
  return result
}

/** low-stock เมื่อ available ต่ำกว่า threshold (spec 02 AC-9) */
export function isLowStock(available: number, threshold: number): boolean {
  return available < threshold
}
