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
  /**
   * "stack" (ค่าเริ่มต้น) = ปุ่มกับสถานะซ้อนกันในกล่องของตัวเอง;
   * "row" = ไม่มีกล่องห่อ (`contents`) ให้แถว `flex-wrap` ของผู้ใช้วางปุ่มในแถว และสถานะขึ้นบรรทัดของตัวเองใต้แถว (CORE-37 กฎข้อ 95c)
   */
  layout?: "stack" | "row"
}

type Status = { message: string; manualValue?: string } | null

const COPY_FAILED = "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง"

const isAbort = (error: unknown) => (error as Error)?.name === "AbortError"

/**
 * CORE-31 (spec 01 กฎข้อ 88): ปุ่มคัดลอกกลางของ storefront — ที่เดียวที่เรียก clipboard
 * กันกดซ้ำด้วย ref (คลิกซ้อนก่อน React render ใหม่) + disable ระหว่างทำงาน; ล้ม → ให้ข้อความไว้คัดลอกเอง
 * CORE-37 (กฎข้อ 95): ค่าที่ให้คัดลอกเองอยู่ใน `<statusTestId>-value` แยกจากข้อความนำ;
 * Web Share ล้มด้วยเหตุอื่นที่ไม่ใช่ผู้ใช้ปิดเอง (AbortError) → ลองคัดลอกต่อ
 */
export default function CopyButton({
  text,
  label,
  successMessage,
  buttonTestId,
  statusTestId,
  size = "medium",
  share,
  layout = "stack",
}: Props) {
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const run = async () => {
    if (running.current) {
      return
    }
    running.current = true
    setBusy(true)
    const value = typeof text === "function" ? text() : text
    try {
      if (share) {
        try {
          if (await share(value)) {
            setStatus(null)
            return
          }
        } catch (error) {
          // ผู้ใช้ปิดหน้าต่างแชร์เอง (AbortError) ไม่ใช่ข้อผิดพลาด — เหตุอื่นลองคัดลอกต่อ
          if (isAbort(error)) {
            setStatus(null)
            return
          }
        }
      }
      await navigator.clipboard.writeText(value)
      setStatus({ message: successMessage })
    } catch {
      setStatus({ message: COPY_FAILED, manualValue: value })
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className={layout === "row" ? "contents" : "flex flex-col gap-y-1"}>
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
        className={`text-small-regular text-ui-fg-subtle ${layout === "row" ? "min-w-0 basis-full" : ""}`}
        data-testid={statusTestId}
      >
        {status?.message}
        {status?.manualValue !== undefined && (
          <span
            className="block select-all font-mono text-ui-fg-base [overflow-wrap:anywhere]"
            data-testid={`${statusTestId}-value`}
          >
            {status.manualValue}
          </span>
        )}
      </span>
    </div>
  )
}
