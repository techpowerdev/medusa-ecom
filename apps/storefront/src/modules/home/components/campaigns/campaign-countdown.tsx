"use client"

import { countdownLabel } from "@lib/util/flash-sale"
import { useEffect, useState } from "react"

/** GB-7c: นับถอยหลังถึง `ends_at` ของแคมเปญบนการ์ดหน้าแรก — เริ่มจากเวลาที่ render (ตรงกับ HTML) แล้วเดินทุกวินาที */
export default function CampaignCountdown({ endsAt, now, testId }: { endsAt: string | null; now: number; testId: string }) {
  const [current, setCurrent] = useState(now)
  const label = countdownLabel(endsAt, current)

  useEffect(() => {
    if (!endsAt) return
    const timer = setInterval(() => {
      const t = Date.now()
      setCurrent(t)
      if (!countdownLabel(endsAt, t)) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [endsAt])

  if (!endsAt) return null
  return (
    <p className="text-small-regular" data-testid={testId}>
      {label ? (
        <>
          เหลือเวลา <span className="tabular-nums">{label}</span>
        </>
      ) : (
        "หมดเวลาแล้ว"
      )}
    </p>
  )
}
