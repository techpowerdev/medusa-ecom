"use client"

import { Button } from "@modules/common/components/ui"
import { useState } from "react"

/** spec 05: แชร์ลิงก์รายสินค้า — ใช้ Web Share เมื่อ browser รองรับ มิฉะนั้นคัดลอกลิงก์ (กันกดซ้ำระหว่างทำงาน) */
export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const share = async () => {
    setBusy(true)
    // share_url เป็น relative เมื่อ backend ไม่ได้ตั้ง STOREFRONT_URL
    const link = new URL(url, window.location.origin).toString()
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: link, title })
        setStatus(null)
      } else {
        await navigator.clipboard.writeText(link)
        setStatus("คัดลอกลิงก์แล้ว")
      }
    } catch (error) {
      // ผู้ใช้ปิดหน้าต่างแชร์เอง (AbortError) ไม่ใช่ข้อผิดพลาด
      setStatus((error as Error)?.name === "AbortError" ? null : `คัดลอกไม่สำเร็จ ลิงก์: ${link}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-1">
      <Button variant="secondary" onClick={share} disabled={busy} isLoading={busy} data-testid="affiliate-share-button">
        แชร์
      </Button>
      <span aria-live="polite" className="text-small-regular text-ui-fg-subtle break-all" data-testid="affiliate-share-status">
        {status}
      </span>
    </div>
  )
}
