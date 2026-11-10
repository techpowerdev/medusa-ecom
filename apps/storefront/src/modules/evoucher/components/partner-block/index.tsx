"use client"

import {
  EvoucherPool,
  evoucherPoolOf,
  partnerBlockPool,
  safeHttpUrl,
  VariantWithPool,
} from "@lib/util/evoucher"
import { useSearchParams } from "next/navigation"
import { useState, useSyncExternalStore } from "react"

type Variants = VariantWithPool[] | null | undefined

/**
 * EV-7b (spec 02 AC-36): ข้อมูลพาร์ทเนอร์ของ voucher variant บน PDP — แสดงเฉพาะเมื่อ variant ที่เลือกมี pool
 * ห้ามแสดง code/PIN (ข้อมูลมาจาก field ของ pool/partner ที่ backend อนุญาตเท่านั้น)
 * EV-7e (กฎข้อ 29c): หน้าเป็น static — HTML จาก server แสดงของ variant ตั้งต้น (ตรงกับที่ ProductActions preselect)
 * แล้วอ่าน `v_id` หลัง mount เท่านั้น (ไม่มี Suspense fallback ที่ทำให้บล็อกซ้อนสองอัน)
 */
export default function EvoucherPartnerBlock({ variants }: { variants: Variants }) {
  // false ตอน prerender/hydrate, true หลัง mount (ไม่ทำให้ hydration mismatch)
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )

  return mounted ? (
    <SelectedVariantPartnerBlock variants={variants} />
  ) : (
    <EvoucherPartnerBlockView pool={evoucherPoolOf({ variants }, null)} />
  )
}

const subscribeNoop = () => () => {}

/** render เฉพาะหลัง mount — `useSearchParams` จึงไม่ถูกเรียกตอน prerender (ไม่ต้องมี Suspense) */
function SelectedVariantPartnerBlock({ variants }: { variants: Variants }) {
  const variantId = useSearchParams().get("v_id")
  // ProductActions เขียน `v_id` ลง URL หลัง mount — นับว่า sync แล้วเมื่อเห็น `v_id` ที่เป็น variant ของสินค้านี้
  const [synced, setSynced] = useState(false)
  if (!synced && variants?.some((v) => v.id === variantId)) {
    setSynced(true)
  }
  return (
    <EvoucherPartnerBlockView
      pool={partnerBlockPool(variants, variantId, synced)}
    />
  )
}

export function EvoucherPartnerBlockView({ pool }: { pool: EvoucherPool | null }) {
  if (!pool) return null
  const { partner } = pool
  // กฎข้อ 26: ข้อมูลเก่าที่บันทึกก่อน EV-14 อาจเป็น `javascript:`/`data:` — render เฉพาะ http(s)
  const logoUrl = safeHttpUrl(partner.logo_url)
  const termsUrl = safeHttpUrl(partner.terms_url)

  return (
    <div
      className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-4 text-small-regular"
      data-testid="evoucher-partner-block"
    >
      <div className="flex items-center gap-x-3">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- โลโก้พาร์ทเนอร์มาจาก URL ภายนอกใดก็ได้ (ไม่อยู่ใน remotePatterns)
          <img src={logoUrl} alt={partner.name} className="h-10 w-10 object-contain" />
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
      {termsUrl && (
        <a
          href={termsUrl}
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
