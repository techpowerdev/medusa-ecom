// กฎข้อ 2, 7: หยุดขาย code ก่อนหมดอายุ 7 วัน (job รายวัน void code ที่ expires_at < cutoff)
export const EXPIRY_GUARD_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export const expiryCutoff = (now: Date): Date =>
  new Date(now.getTime() + EXPIRY_GUARD_DAYS * DAY_MS)

/** วันที่ตามปฏิทินไทย (UTC+7, ไม่มี DST) เช่น "2026-10-25" — ใช้ทำ idempotency key รายวัน */
export const bangkokDateKey = (now: Date): string =>
  new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10)
