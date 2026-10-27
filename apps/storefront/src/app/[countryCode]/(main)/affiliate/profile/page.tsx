import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getAffiliate } from "@lib/data/affiliate-portal"
import { getBaseURL } from "@lib/util/env"
import CopyLinkButton from "@modules/affiliate/components/copy-link-button"

export const metadata: Metadata = { title: "โปรไฟล์แอฟฟิลิเอต", robots: { index: false } }

// AF-8b (กฎ 33, 34): ข้อมูลของ affiliate + ลิงก์เริ่มต้น `{storefront}/r/{code}` + สถานะข้อมูลรับเงินจาก has_payout_info
// (ไม่แสดง payout_info ดิบ — API ไม่ส่งมา; กฎ 8)
export default async function AffiliateProfilePage({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const affiliate = await getAffiliate()
  if (!affiliate) {
    redirect(`/${countryCode}/affiliate/login`)
  }
  const link = `${getBaseURL()}/r/${affiliate.code}`

  return (
    <div className="content-container py-8 flex flex-col gap-y-6" data-testid="affiliate-profile-page">
      <h1 className="text-xl-semi">โปรไฟล์</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
        <dt className="text-ui-fg-subtle">ชื่อ</dt>
        <dd>{affiliate.name}</dd>
        <dt className="text-ui-fg-subtle">อีเมล</dt>
        <dd>{affiliate.email}</dd>
        <dt className="text-ui-fg-subtle">รหัสแนะนำ</dt>
        <dd>{affiliate.code}</dd>
        <dt className="text-ui-fg-subtle">ข้อมูลรับเงิน</dt>
        <dd data-testid="affiliate-payout-info-status">
          {affiliate.has_payout_info
            ? "บันทึกข้อมูลรับเงินแล้ว"
            : "ยังไม่มีข้อมูลรับเงิน กรุณาติดต่อผู้ดูแลเพื่อบันทึกข้อมูลบัญชีรับเงิน"}
        </dd>
      </dl>
      <div className="flex flex-col gap-y-2">
        <p className="text-base-semi">ลิงก์แนะนำเริ่มต้น</p>
        <p className="break-all" data-testid="affiliate-default-link">
          {link}
        </p>
        <CopyLinkButton link={link} />
      </div>
    </div>
  )
}
