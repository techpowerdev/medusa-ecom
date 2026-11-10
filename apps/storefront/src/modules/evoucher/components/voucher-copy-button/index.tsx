"use client"

import CopyButton from "@modules/common/components/copy-button"

/** EV-7b (spec 02 AC-6): คัดลอก code ลง clipboard ของเครื่องผู้ใช้ — ไม่เก็บค่าไว้ที่อื่น (ผ่าน CopyButton กลาง — CORE-31 กฎข้อ 88) */
export default function VoucherCopyButton({ code }: { code: string }) {
  return (
    <CopyButton
      text={code}
      label="คัดลอกรหัส"
      successMessage="คัดลอกแล้ว"
      buttonTestId="voucher-copy-button"
      statusTestId="voucher-copy-status"
      size="small"
      layout="row"
    />
  )
}
