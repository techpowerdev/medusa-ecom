import { formatAmount, formatDate } from "../affiliate-format"

// AF-6 (review #138): เวลาใน admin แสดงตามเวลาไทย (Asia/Bangkok) ไม่ขึ้นกับ timezone ของเครื่อง
describe("formatDate", () => {
  it("formats in Asia/Bangkok with or without time", () => {
    expect(formatDate("2026-10-27T17:30:00.000Z")).toBe("Oct 28, 2026, 12:30 AM")
    expect(formatDate("2026-10-27T17:30:00.000Z", false)).toBe("Oct 28, 2026")
  })

  it("returns a dash for empty values", () => {
    expect(formatDate(null)).toBe("-")
  })
})

// จำนวนเงินเป็นหน่วยหลัก (major units) ตามที่ API ส่งมา — ไม่หาร 100
describe("formatAmount", () => {
  it("formats with Intl currency style", () => {
    expect(formatAmount(1234.5, "thb")).toMatch(/^THB\s1,234\.50$/)
    expect(formatAmount("-20", "thb")).toMatch(/^-THB\s20\.00$/)
  })
})
