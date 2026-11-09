import { ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { isMalformedOffset } from "../../lib/page-offset"

/**
 * ครอบ `DataTable` ของ dashboard ที่ใช้ `usePageOffset`: ไม่ render จนกว่า `<prefix>_offset` ใน URL จะไม่ผิดรูป
 * DataTable 2.22.1 parseInt ค่าดิบเอง ("-50" → pageIndex -1 → Next = หน้า 0, "abc" → NaN) และ URL แก้ด้วย navigation ที่ต้องรอ loader
 * ก่อน commit (แล้ว render ใน startTransition) → ปุ่มที่กดในช่วงนั้นคำนวณจากค่าผิดแล้วหาย — usePageOffset (ใน parent) ยังทำงานระหว่างซ่อนตาราง
 */
export const PageOffsetGate = ({ prefix, children }: { prefix: string; children: ReactNode }) => {
  const [searchParams] = useSearchParams()
  return isMalformedOffset(searchParams.get(`${prefix}_offset`)) ? null : <>{children}</>
}
