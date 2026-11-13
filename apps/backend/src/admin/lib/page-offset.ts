// ADM-10 (spec 08 กฎ 13a): offset ของตาราง DataTable ของ dashboard ใน URL (`<prefix>_offset`) ผู้ใช้แก้เองได้
// pure — ไม่ import ui/dashboard เพื่อให้ unit test ได้; hook ที่แก้ URL อยู่ที่ components/common/use-page-offset.ts

// ไม่มี param = ปกติ; ค่าอื่นที่ไม่ใช่ตัวเลขล้วน ("abc", "-50", "12.5", "1e1", "Infinity") = ผิดรูป
export const isMalformedOffset = (raw: string | null): boolean => raw !== null && !/^\d+$/.test(raw)

// ผิดรูป → หน้าแรก; อื่นๆ ปัดลงเป็นต้นหน้า
export const pageOffset = (raw: string | undefined, pageSize: number): number => {
  if (!raw || isMalformedOffset(raw)) {
    return 0
  }
  return Math.floor(Number(raw) / pageSize) * pageSize
}

// offset เกินจำนวนแถว → ต้นหน้าสุดท้าย (ไม่มีแถว → หน้าแรก)
export const clampOffset = (offset: number, count: number, pageSize: number): number => {
  if (count === 0) {
    return 0
  }
  return offset >= count ? Math.floor((count - 1) / pageSize) * pageSize : offset
}

// ADM-23 (spec 08 กฎ 27a): มีแถว (count > 0) แต่หน้านี้ว่าง = offset เกินที่ usePageOffset กำลัง clamp
// (รวม placeholder ระหว่างโหลดหน้าที่ clamp แล้ว) → ตารางแสดง loading แทน empty state ที่ไม่จริง; ยังไม่มี data = false
export const isPastLastPage = (count: number | undefined, rows: number | undefined): boolean =>
  !!count && count > 0 && rows === 0
