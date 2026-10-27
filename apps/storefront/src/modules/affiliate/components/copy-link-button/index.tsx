"use client"

import { Button } from "@modules/common/components/ui"
import { useState } from "react"

/** AF-8b: ปุ่มคัดลอกลิงก์เริ่มต้นของ affiliate (กันกดซ้ำระหว่างทำงาน) */
export default function CopyLinkButton({ link }: { link: string }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const copy = async () => {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(link)
      setStatus("คัดลอกลิงก์แล้ว")
    } catch {
      setStatus(`คัดลอกไม่สำเร็จ ลิงก์: ${link}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-1">
      <Button variant="secondary" onClick={copy} disabled={busy} isLoading={busy} data-testid="affiliate-default-link-copy">
        คัดลอกลิงก์
      </Button>
      <span aria-live="polite" className="text-small-regular text-ui-fg-subtle break-all" data-testid="affiliate-default-link-status">
        {status}
      </span>
    </div>
  )
}
