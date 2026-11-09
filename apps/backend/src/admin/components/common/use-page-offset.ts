import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { clampOffset, pageOffset } from "../../lib/page-offset"

type Options = {
  /** จำนวนแถวทั้งหมดจาก response ล่าสุด — รู้แล้วจึง clamp offset ที่เกิน (undefined = ยังไม่รู้) */
  count?: number
  /** ค่า filter ของตาราง — เปลี่ยนเมื่อไรกลับหน้าแรก */
  resetOn?: unknown
}

/**
 * ADM-10 (spec 08 กฎ 13b–c): offset ของ `DataTable` ของ dashboard ที่อ่านจาก `<prefix>_offset`
 * DataTable ของ dashboard 2.22.1 parseInt ค่าดิบเอง ("abc" → "NaN of N pages", "-50" → "0 of N pages", เกิน → ตารางว่าง)
 * → คืน offset ที่ normalize/clamp แล้วสำหรับ request และแก้ URL ให้ตรงด้วย replace (ไม่เพิ่ม history; 0 = ลบ param)
 *
 * reset เมื่อ filter เปลี่ยน (กฎ 17 — workaround upstream): DataTable ลบ offset แล้วตั้ง filter ด้วย setSearchParams สองครั้ง
 * ใน tick เดียว บน react-router 7 ครั้งหลังเขียนทับครั้งแรก offset จึงค้าง → hook นี้เป็นผู้เขียน offset ลง URL ตัวเดียว
 * และคืน 0 ตั้งแต่ `resetOn` เปลี่ยนจนกว่า URL ไม่มี offset แล้วจริง (ไม่ยิง request ของหน้าเก่า)
 * — หน้าที่มี loader: การลบ offset ทำให้ router revalidate loader ก่อนอัปเดต URL จึงจำค่า filter ใหม่ได้เมื่อ offset หายไปแล้วเท่านั้น
 */
export const usePageOffset = (prefix: string, pageSize: number, { count, resetOn }: Options = {}) => {
  const key = `${prefix}_offset`
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(key)
  const [seen, setSeen] = useState(resetOn)
  const resetting = !Object.is(resetOn, seen)

  const normalized = pageOffset(raw ?? undefined, pageSize)
  const offset = resetting ? 0 : count === undefined ? normalized : clampOffset(normalized, count, pageSize)
  const target = offset ? String(offset) : null

  useEffect(() => {
    if (raw === target) {
      if (resetting) {
        setSeen(resetOn)
      }
      return
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (target === null) next.delete(key)
        else next.set(key, target)
        return next
      },
      { replace: true }
    )
  }, [key, raw, target, resetting, resetOn, setSearchParams])

  return offset
}
