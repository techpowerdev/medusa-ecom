import { bangkokDateKey, EXPIRY_GUARD_DAYS, expiryCutoff } from "../utils/expiry"

describe("expiry guard (กฎข้อ 2, 7)", () => {
  it("stops selling codes 7 days before they expire", () => {
    expect(EXPIRY_GUARD_DAYS).toBe(7)
  })

  it("cutoff = now + 7 days (code ที่ expires_at < cutoff ต้องถูก void)", () => {
    const now = new Date("2026-10-25T01:00:00.000Z")
    expect(expiryCutoff(now).toISOString()).toBe("2026-11-01T01:00:00.000Z")
  })
})

describe("bangkokDateKey (AC-9: 1 ฉบับต่อวันต่อ pool)", () => {
  it("uses the calendar day in Asia/Bangkok (UTC+7)", () => {
    expect(bangkokDateKey(new Date("2026-10-25T16:59:59.999Z"))).toBe("2026-10-25")
    expect(bangkokDateKey(new Date("2026-10-25T17:00:00.000Z"))).toBe("2026-10-26")
  })
})
