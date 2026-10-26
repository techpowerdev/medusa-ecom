import { MedusaError } from "@medusajs/framework/utils"
import {
  expiredGroupOutcome,
  isCampaignExpired,
  payDeadlineAt,
  deadlineBatchSkip,
  resolveGroupOutcomeTransition,
} from "../utils/group-outcome"

// spec 04 กฎข้อ 8: กลุ่มสำเร็จได้ครั้งเดียว; succeed/fail idempotent
describe("resolveGroupOutcomeTransition", () => {
  it.each([
    ["open", "succeeded", "apply"],
    ["open", "failed", "apply"],
    ["succeeded", "succeeded", "noop"],
    ["failed", "failed", "noop"],
  ] as const)("%s → %s = %s", (from, to, expected) => {
    expect(resolveGroupOutcomeTransition(from, to)).toEqual(expected)
  })

  it.each([
    ["succeeded", "failed"],
    ["failed", "succeeded"],
  ] as const)("%s → %s throws not_allowed", (from, to) => {
    expect(() => resolveGroupOutcomeTransition(from, to)).toThrow(
      expect.objectContaining({ type: MedusaError.Types.NOT_ALLOWED })
    )
  })
})

describe("payDeadlineAt", () => {
  it("adds pay_within_hours to now", () => {
    const now = new Date("2026-10-26T10:00:00.000Z")
    expect(payDeadlineAt(now, 24).toISOString()).toEqual("2026-10-27T10:00:00.000Z")
    expect(payDeadlineAt(now, 1).toISOString()).toEqual("2026-10-26T11:00:00.000Z")
  })
})

// AC-11, AC-12: ที่ ends_at ของกลุ่ม ถึงเป้าหมาย → succeeded มิฉะนั้น failed
describe("expiredGroupOutcome", () => {
  it.each([
    ["units", 10, { progress_orders: 2, progress_units: 10, progress_people: 2 }, "succeeded"],
    ["units", 10, { progress_orders: 2, progress_units: 9, progress_people: 2 }, "failed"],
    ["people", 3, { progress_orders: 4, progress_units: 4, progress_people: 3 }, "succeeded"],
    ["people", 3, { progress_orders: 4, progress_units: 4, progress_people: 2 }, "failed"],
  ] as const)("%s target %d → %s", (target_type, target_value, progress, expected) => {
    expect(expiredGroupOutcome({ target_type, target_value }, progress)).toEqual(expected)
  })
})

// AC-22: แคมเปญ active ที่ Medusa campaign ends_at <= now → ended
describe("isCampaignExpired", () => {
  const now = new Date("2026-10-26T10:00:00.000Z")
  it.each([
    ["2026-10-26T09:59:59.000Z", true],
    ["2026-10-26T10:00:00.000Z", true],
    ["2026-10-26T10:00:01.000Z", false],
    [null, false],
  ] as const)("ends_at %s → %s", (endsAt, expected) => {
    expect(isCampaignExpired(endsAt, now)).toBe(expected)
  })
})

// review #89: กลุ่มที่ล้มซ้ำต้องไม่บังกลุ่มอื่นที่หัวคิว — แต่ละรอบเลื่อนหน้าต่าง BATCH ไปเรื่อยๆ
describe("deadlineBatchSkip", () => {
  it("starts at 0 when everything fits in one batch", () => {
    expect(deadlineBatchSkip(50, 50, 7)).toEqual(0)
    expect(deadlineBatchSkip(0, 50, 7)).toEqual(0)
  })

  it("rotates the window over every group across ticks", () => {
    expect([0, 1, 2, 3].map((tick) => deadlineBatchSkip(120, 50, tick))).toEqual([0, 50, 100, 30])
  })
})
