import { bangkokDateKey, EXPIRY_GUARD_DAYS, expiryCutoff, planExpiringCodes } from "../utils/expiry"

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

// EV-12 (กฎข้อ 12b, AC-30): เว้น code ใกล้หมดอายุไว้เท่าที่ order ที่จองแล้วต้องใช้ (`keep`) ไกลสุดก่อน
describe("planExpiringCodes (กฎข้อ 12b)", () => {
  const now = new Date("2026-10-27T01:00:00.000Z")
  const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const near = (...entries: [string, number][]) =>
    entries.map(([id, days]) => ({ id, expires_at: inDays(days) }))

  it("P: keeps reserved − long codes, farthest expiry first, and voids the rest", () => {
    const plan = planExpiringCodes({ now, near: near(["c2", 2], ["c4", 4], ["c5", 5]), long: 0, reserved: 2 })
    expect(plan).toEqual({
      keep_ids: ["c5", "c4"],
      void_ids: ["c2"],
      kept_earliest_expires_at: inDays(4).toISOString(),
    })
  })

  it("Q: voids everything when nothing is reserved", () => {
    const plan = planExpiringCodes({ now, near: near(["a", 1], ["b", 3]), long: 0, reserved: 0 })
    expect(plan).toEqual({ keep_ids: [], void_ids: ["a", "b"], kept_earliest_expires_at: null })
  })

  it("R: long-lived codes count towards the reservation", () => {
    const plan = planExpiringCodes({ now, near: near(["a", 1], ["b", 3]), long: 1, reserved: 1 })
    expect(plan.keep_ids).toEqual([])
    expect(plan.void_ids.sort()).toEqual(["a", "b"])
  })

  it("S: keeps at most the near codes there are (keep = min(near, reserved − long))", () => {
    const plan = planExpiringCodes({ now, near: near(["a", 3]), long: 0, reserved: 3 })
    expect(plan).toEqual({ keep_ids: ["a"], void_ids: [], kept_earliest_expires_at: inDays(3).toISOString() })
  })

  it("T: never keeps a code that has already expired", () => {
    const plan = planExpiringCodes({ now, near: near(["past", -1], ["now", 0]), long: 0, reserved: 2 })
    expect(plan).toEqual({ keep_ids: [], void_ids: ["past", "now"], kept_earliest_expires_at: null })
  })

  it("breaks ties on expires_at by id", () => {
    const plan = planExpiringCodes({ now, near: near(["b", 4], ["a", 4], ["c", 4]), long: 0, reserved: 2 })
    expect(plan.keep_ids).toEqual(["a", "b"])
    expect(plan.void_ids).toEqual(["c"])
  })

  it("accepts ISO strings for expires_at", () => {
    const plan = planExpiringCodes({
      now,
      near: [{ id: "a", expires_at: inDays(2).toISOString() }],
      long: 0,
      reserved: 1,
    })
    expect(plan.keep_ids).toEqual(["a"])
  })
})
