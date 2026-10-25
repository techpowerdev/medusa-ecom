import { isTargetReached } from "../utils/target"

// spec 04 business rule 1: orders = membership ที่ไม่ถูกยกเลิก, units = ผลรวมชิ้น, people = ลูกค้าไม่ซ้ำ
describe("isTargetReached", () => {
  const progress = { progress_orders: 4, progress_units: 9, progress_people: 2 }

  it.each([
    ["orders", 4, true],
    ["orders", 5, false],
    ["units", 9, true],
    ["units", 10, false],
    ["people", 2, true],
    ["people", 3, false],
  ] as const)(
    "target_type=%s target_value=%d → %s",
    (target_type, target_value, expected) => {
      expect(isTargetReached({ target_type, target_value }, progress)).toBe(
        expected
      )
    }
  )

  it("counts progress above the target as reached", () => {
    expect(
      isTargetReached(
        { target_type: "units", target_value: 3 },
        { progress_orders: 1, progress_units: 5, progress_people: 1 }
      )
    ).toBe(true)
  })
})
