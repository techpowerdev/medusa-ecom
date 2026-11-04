"use client"

import { countdownLabel } from "@lib/util/flash-sale"
import { useEffect, useState } from "react"

/** GB-7a1 (AC-16a): นับถอยหลังถึง `ends_at` ของกลุ่ม — เริ่มจากเวลาของ request (ตรงกับ HTML ฝั่ง server) แล้วเดินทุกวินาที */
export default function GroupCountdown({ endsAt, now }: { endsAt: string | null; now: number }) {
  const [current, setCurrent] = useState(now)
  const label = countdownLabel(endsAt, current)

  // เดินทุกวินาทีจนเลย `ends_at` (label เป็น null แล้วหยุด) — deps ตาม `endsAt` ไม่สร้าง interval ใหม่ทุก tick
  useEffect(() => {
    if (!endsAt) return
    const timer = setInterval(() => {
      const t = Date.now()
      setCurrent(t)
      if (!countdownLabel(endsAt, t)) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  return (
    <p className="text-base-regular" data-testid="group-countdown">
      {label ? (
        <>
          เหลือเวลา <span className="tabular-nums">{label}</span>
        </>
      ) : (
        "หมดเวลารวมกลุ่มแล้ว"
      )}
    </p>
  )
}
