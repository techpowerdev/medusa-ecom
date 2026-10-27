"use client"

import { EvoucherPool, evoucherPoolOf } from "@lib/util/evoucher"
import { useSearchParams } from "next/navigation"

type Variants = Parameters<typeof evoucherPoolOf>[0]["variants"]

/**
 * EV-7b (spec 02 AC-36): ข้อมูลพาร์ทเนอร์ของ voucher variant บน PDP — แสดงเฉพาะเมื่อ variant ที่เลือก (`?v_id=`) มี pool
 * ห้ามแสดง code/PIN (ข้อมูลมาจาก field ของ pool/partner ที่ backend อนุญาตเท่านั้น)
 */
export default function EvoucherPartnerBlock({ variants }: { variants: Variants }) {
  const variantId = useSearchParams().get("v_id")
  return <EvoucherPartnerBlockView pool={evoucherPoolOf({ variants }, variantId)} />
}

export function EvoucherPartnerBlockView({ pool }: { pool: EvoucherPool | null }) {
  if (!pool) return null
  const { partner } = pool

  return (
    <div
      className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4 text-small-regular"
      data-testid="evoucher-partner-block"
    >
      <div className="flex items-center gap-x-3">
        {partner.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- โลโก้พาร์ทเนอร์มาจาก URL ภายนอกใดก็ได้ (ไม่อยู่ใน remotePatterns)
          <img src={partner.logo_url} alt={partner.name} className="h-10 w-10 object-contain" />
        )}
        <div className="flex flex-col">
          <span className="text-ui-fg-muted">บัตรกำนัลจากพาร์ทเนอร์</span>
          <span className="text-base-semi" data-testid="evoucher-partner-name">
            {partner.name}
          </span>
        </div>
      </div>
      <div>
        <span className="font-semibold">วิธีใช้</span>
        <p className="whitespace-pre-line" data-testid="evoucher-how-to-use">
          {pool.how_to_use}
        </p>
      </div>
      {pool.validity_note && (
        <div>
          <span className="font-semibold">ระยะเวลาใช้งาน</span>
          <p data-testid="evoucher-validity-note">{pool.validity_note}</p>
        </div>
      )}
      <p className="text-ui-fg-subtle" data-testid="evoucher-delivery-note">
        ส่งมอบรหัสทางอีเมลหลังชำระเงิน และดูได้ที่หน้าบัตรกำนัลของฉันในบัญชี
      </p>
      {partner.terms_url && (
        <a
          href={partner.terms_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          data-testid="evoucher-terms-link"
        >
          ข้อกำหนดและเงื่อนไขของพาร์ทเนอร์
        </a>
      )}
    </div>
  )
}
