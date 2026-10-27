// กฎข้อ 2, 7: หยุดขาย code ก่อนหมดอายุ 7 วัน (job รายวัน void code ที่ expires_at < cutoff)
export const EXPIRY_GUARD_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export const expiryCutoff = (now: Date): Date =>
  new Date(now.getTime() + EXPIRY_GUARD_DAYS * DAY_MS)

/** วันที่ตามปฏิทินไทย (UTC+7, ไม่มี DST) เช่น "2026-10-25" — ใช้ทำ idempotency key รายวัน */
export const bangkokDateKey = (now: Date): string =>
  new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10)

export type ExpiringCode = { id: string; expires_at: Date | string }

export type ExpiringCodesPlan = {
  keep_ids: string[]
  void_ids: string[]
  /** expires_at ที่เร็วที่สุดของ code ที่เว้น (ISO) — null ถ้าไม่เว้น */
  kept_earliest_expires_at: string | null
}

/**
 * EV-12 (กฎข้อ 12b): `near` = code `available` ที่ expires_at < now + 7 วัน, `long` = จำนวน code `available` ที่เหลือ
 * keep = min(near ที่ยังไม่หมดอายุ, max(0, reserved − long)) เลือก expires_at ไกลสุดก่อน (เท่ากันเรียง id) ที่เหลือ void
 */
export const planExpiringCodes = (input: {
  now: Date
  near: ExpiringCode[]
  long: number
  reserved: number
}): ExpiringCodesPlan => {
  const time = (code: ExpiringCode) => new Date(code.expires_at).getTime()
  const candidates = input.near
    .filter((code) => time(code) > input.now.getTime())
    .sort((a, b) => time(b) - time(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const keep = Math.min(candidates.length, Math.max(0, input.reserved - input.long))
  const kept = candidates.slice(0, keep)
  const keepIds = new Set(kept.map((code) => code.id))
  return {
    keep_ids: kept.map((code) => code.id),
    void_ids: input.near.filter((code) => !keepIds.has(code.id)).map((code) => code.id),
    kept_earliest_expires_at: kept.length ? new Date(time(kept[kept.length - 1])).toISOString() : null,
  }
}
