"use client"

import { countdownLabel } from "@lib/util/flash-sale"
import { useEffect, useState } from "react"

/** GB-7a1 (AC-16a): นับถอยหลังถึง `ends_at` ของกลุ่ม — เริ่มจากเวลาของ request (ตรงกับ HTML ฝั่ง server) แล้วเดินทุกวินาที */
export default function GroupCountdown({ endsAt, now }: { endsAt: string | null; now: number }) {
  const [current, setCurrent] = useState(now)
  const label = countdownLabel(endsAt, current)

  useEffect(() => {
    if (!label) return
    const timer = setInterval(() => setCurrent(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [label])

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
