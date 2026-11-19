import { clampOffset, isMalformedOffset, isPastLastPage, pageOffset } from "../page-offset"

// ADM-10 (spec 08 กฎ 13a, AC-14): `<prefix>_offset` ใน URL ผู้ใช้แก้เองได้ — ค่าที่ไม่ใช่จำนวนเต็มบวกใช้หน้าแรก
// และค่าอื่นปัดลงเป็นต้นหน้า (DataTable ของ dashboard คำนวณหน้าจาก offset / pageSize)
describe("pageOffset", () => {
  it.each([undefined, "", "abc", "-50", "NaN", "Infinity", "12.5", "0"])("%p → 0", (raw) => {
    expect(pageOffset(raw, 50)).toBe(0)
  })

  it.each([
    ["75", 50, 50],
    ["50", 50, 50],
    ["25", 20, 20],
    ["1e1", 20, 0],
    ["40", 20, 40],
    ["99999999", 50, 99999950],
  ] as const)("pageOffset(%p, %p) = %p", (raw, pageSize, expected) => {
    expect(pageOffset(raw, pageSize)).toBe(expected)
  })
})

// ADM-10 (กฎ 13a): offset เกินจำนวนแถว → ต้นหน้าสุดท้าย (ไม่แสดงตารางว่างทั้งที่มีข้อมูล)
describe("clampOffset", () => {
  it.each([
    [99999950, 60, 50, 50],
    [50, 60, 50, 50],
    [100, 0, 50, 0],
    [0, 60, 50, 0],
    [60, 60, 50, 50],
    [100, 100, 50, 50],
    [40, 41, 20, 40],
  ] as const)("clampOffset(%p, %p, %p) = %p", (offset, count, pageSize, expected) => {
    expect(clampOffset(offset, count, pageSize)).toBe(expected)
  })
})

// hotfix: DataTable ของ dashboard parseInt ค่าดิบเอง ("-50" → pageIndex -1, "abc" → NaN) — ค่าเหล่านี้ต้องไม่ถึงตาราง
describe("isMalformedOffset", () => {
  it.each(["abc", "-50", "NaN", "Infinity", "12.5", "1e1", ""])("%p → true", (raw) => {
    expect(isMalformedOffset(raw)).toBe(true)
  })

  it.each([null, "0", "50", "75", "99999999"])("%p → false", (raw) => {
    expect(isMalformedOffset(raw)).toBe(false)
  })
})

// ADM-23 (spec 08 กฎ 27a, AC-28): มีแถว (count > 0) แต่หน้านี้ว่าง = offset เกินที่ usePageOffset กำลัง clamp
// → ตารางแสดง loading แทน empty state (ผู้ใช้: codes-table, partners-section)
describe("isPastLastPage", () => {
  it.each([
    [5, 0, true],
    [0, 0, false],
    [5, 2, false],
    [undefined, undefined, false],
  ] as const)("count %p แถว %p → %p", (count, rows, expected) => {
    expect(isPastLastPage(count, rows)).toBe(expected)
  })
})
