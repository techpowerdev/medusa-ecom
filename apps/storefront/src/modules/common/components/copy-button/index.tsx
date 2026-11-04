"use client"

import { Button } from "@modules/common/components/ui"
import { useRef, useState } from "react"

type Props = {
  /** ข้อความที่คัดลอก — ฟังก์ชันใช้เมื่อค่าต้องคำนวณตอนคลิก (เช่น URL absolute จาก window.location) */
  text: string | (() => string)
  label: string
  successMessage: string
  buttonTestId: string
  statusTestId: string
  size?: "small" | "medium"
  /** ทางเลือกแทนการคัดลอก (เช่น Web Share) — คืน true เมื่อจัดการแล้ว; ตัดสินตอนคลิก */
  share?: (text: string) => Promise<boolean>
}

/**
 * CORE-31 (spec 01 กฎข้อ 88): ปุ่มคัดลอกกลางของ storefront — ที่เดียวที่เรียก clipboard
 * กันกดซ้ำด้วย ref (คลิกซ้อนก่อน React render ใหม่) + disable ระหว่างทำงาน; ล้ม → ให้ข้อความไว้คัดลอกเอง
 */
export default function CopyButton({
  text,
  label,
  successMessage,
  buttonTestId,
  statusTestId,
  size = "medium",
  share,
}: Props) {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const run = async () => {
    if (running.current) {
      return
    }
    running.current = true
    setBusy(true)
    const value = typeof text === "function" ? text() : text
    try {
      if (share && (await share(value))) {
        setStatus(null)
      } else {
        await navigator.clipboard.writeText(value)
        setStatus(successMessage)
      }
    } catch (error) {
      // ผู้ใช้ปิดหน้าต่างแชร์เอง (AbortError) ไม่ใช่ข้อผิดพลาด
      setStatus(
        (error as Error)?.name === "AbortError" ? null : `คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง: ${value}`
      )
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-1">
      <Button
        type="button"
        variant="secondary"
        size={size}
        onClick={run}
        disabled={busy}
        isLoading={busy}
        data-testid={buttonTestId}
      >
        {label}
      </Button>
      <span
        aria-live="polite"
        className="text-small-regular text-ui-fg-subtle break-all"
        data-testid={statusTestId}
      >
        {status}
      </span>
    </div>
  )
}
