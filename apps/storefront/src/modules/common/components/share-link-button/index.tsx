"use client"

import CopyButton from "@modules/common/components/copy-button"

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
 * Web Share ไม่รองรับ → คัดลอกลิงก์ผ่าน CopyButton กลาง (CORE-31 กฎข้อ 88); กันกดซ้ำอยู่ใน CopyButton
 */
export default function ShareLinkButton({ url, label, buttonTestId, statusTestId, shareTitle }: Props) {
  // share_url เป็น relative เมื่อ backend ไม่ได้ตั้ง STOREFRONT_URL → แปลงเป็น absolute ตอนคลิก
  const absolute = () => new URL(url, window.location.origin).toString()

  // ตรวจ Web Share ตอนคลิก (ไม่ใช่ตอน mount) — browser/e2e อาจไม่มี navigator.share
  const share = async (link: string) => {
    if (shareTitle === undefined || typeof navigator.share !== "function") {
      return false
    }
    await navigator.share({ url: link, title: shareTitle })
    return true
  }

  return (
    <CopyButton
      text={absolute}
      label={label}
      successMessage="คัดลอกลิงก์แล้ว"
      buttonTestId={buttonTestId}
      statusTestId={statusTestId}
      share={share}
    />
  )
}
