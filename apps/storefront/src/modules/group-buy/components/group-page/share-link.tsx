"use client"

import { Button } from "@modules/common/components/ui"
import { useState } from "react"

/** GB-7a1 (กฎข้อ 29b, 29g): ลิงก์แชร์ `/g/<token>` + ปุ่มคัดลอก */
export default function GroupShareLink({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setStatus("copied")
    } catch {
      setStatus("failed")
    }
  }

  return (
    <div className="flex flex-col gap-y-2">
      <span className="text-small-regular text-ui-fg-subtle">แชร์ลิงก์นี้ให้เพื่อนเข้าร่วมกลุ่ม</span>
      <div className="flex flex-col gap-2 small:flex-row small:items-center">
        <a href={url} className="break-all text-ui-fg-interactive underline" data-testid="group-share-link">
          {url}
        </a>
        <Button type="button" variant="secondary" size="small" onClick={copy} aria-live="polite" data-testid="group-share-copy">
          {status === "copied" ? "คัดลอกแล้ว" : status === "failed" ? "คัดลอกไม่สำเร็จ" : "คัดลอกลิงก์"}
        </Button>
      </div>
    </div>
  )
}
