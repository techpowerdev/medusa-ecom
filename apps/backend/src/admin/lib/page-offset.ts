// ADM-10 (spec 08 กฎ 13a): offset ของตาราง DataTable ของ dashboard ใน URL (`<prefix>_offset`) ผู้ใช้แก้เองได้
// pure — ไม่ import ui/dashboard เพื่อให้ unit test ได้; hook ที่แก้ URL อยู่ที่ components/common/use-page-offset.ts

// ไม่ใช่จำนวนเต็มบวกแบบตัวเลขล้วน ("abc", "-50", "12.5", "1e1", "Infinity") → หน้าแรก; อื่นๆ ปัดลงเป็นต้นหน้า
export const pageOffset = (raw: string | undefined, pageSize: number): number => {
  if (!raw || !/^\d+$/.test(raw)) {
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
