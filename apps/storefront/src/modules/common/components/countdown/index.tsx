"use client"

import { countdownLabel } from "@lib/util/flash-sale"
import { useEffect, useState } from "react"

type Props = {
  endsAt: string | null
  /** เวลาของ request — เริ่มจากค่านี้ให้ตรงกับ HTML ฝั่ง server แล้วเดินทุกวินาที */
  now: number
  testId: string
  /** ข้อความเมื่อเลย `endsAt` (แต่ละที่ใช้ข้อความของตัวเอง) */
  expiredLabel: string
  className?: string
}

// GB-12 (spec 04 กฎข้อ 32a): นับถอยหลังของการ์ดแคมเปญหน้าแรก (GB-7c) และหน้ากลุ่ม (GB-7a1) — แทน CampaignCountdown/GroupCountdown
export default function Countdown({
  endsAt,
  now,
  testId,
  expiredLabel,
  className = "text-small-regular",
}: Props) {
  const [current, setCurrent] = useState(now)
  const label = countdownLabel(endsAt, current)

  // เดินทุกวินาทีจนเลย `endsAt` (label เป็น null แล้วหยุด) — deps ตาม `endsAt` ไม่สร้าง interval ใหม่ทุก tick
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
    <p className={className} data-testid={testId}>
      {label ? (
        <>
          เหลือเวลา <span className="tabular-nums">{label}</span>
        </>
      ) : (
        expiredLabel
      )}
    </p>
  )
}
