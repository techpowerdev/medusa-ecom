"use client"

import { Button } from "@modules/common/components/ui"
import { useState } from "react"

/** EV-7b (spec 02 AC-6): คัดลอก code ลง clipboard ของเครื่องผู้ใช้ — ไม่เก็บค่าไว้ที่อื่น */
export default function VoucherCopyButton({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setStatus("copied")
    } catch {
      setStatus("failed")
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      onClick={copy}
      aria-live="polite"
      data-testid="voucher-copy-button"
    >
      {status === "copied" ? "คัดลอกแล้ว" : status === "failed" ? "คัดลอกไม่สำเร็จ" : "คัดลอกรหัส"}
    </Button>
  )
}
