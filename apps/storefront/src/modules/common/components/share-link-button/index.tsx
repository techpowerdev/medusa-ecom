"use client"

import { Button } from "@modules/common/components/ui"
import { useState } from "react"

type Props = {
  url: string
  label: string
  buttonTestId: string
  statusTestId: string
  /** มี = ใช้ Web Share เมื่อ browser รองรับ (การ์ด Products); ไม่มี = คัดลอกลิงก์อย่างเดียว (Profile) */
  shareTitle?: string
}

/**
 * spec 05 (AF-8a/AF-8b, AF-N3 กฎ 40b): ปุ่มคัดลอก/แชร์ลิงก์ — component เดียวของ Profile, การ์ด Products ของ portal และหน้ากลุ่ม (GB-7a1)
 * Web Share ไม่รองรับ → คัดลอกลิงก์; กันกดซ้ำระหว่างทำงาน
 */
export default function ShareLinkButton({ url, label, buttonTestId, statusTestId, shareTitle }: Props) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    // share_url เป็น relative เมื่อ backend ไม่ได้ตั้ง STOREFRONT_URL
    const link = new URL(url, window.location.origin).toString()
    try {
      if (shareTitle !== undefined && typeof navigator.share === "function") {
        await navigator.share({ url: link, title: shareTitle })
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
      <Button variant="secondary" onClick={run} disabled={busy} isLoading={busy} data-testid={buttonTestId}>
        {label}
      </Button>
      <span aria-live="polite" className="text-small-regular text-ui-fg-subtle break-all" data-testid={statusTestId}>
        {status}
      </span>
    </div>
  )
}
