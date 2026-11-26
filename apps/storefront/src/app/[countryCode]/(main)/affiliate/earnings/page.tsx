import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getAffiliate, getAffiliateEarnings } from "@lib/data/affiliate-portal"
import { EARNING_STATUSES, earningsByStatus, portalAmount } from "@lib/util/affiliate-portal"
import PortalError from "@modules/affiliate/components/portal-error"
import StatusNotice from "@modules/affiliate/components/status-notice"

export const metadata: Metadata = { title: "รายได้แอฟฟิลิเอต", robots: { index: false } }

const LABEL = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว รอจ่าย",
  paid: "จ่ายแล้ว",
  reversed: "ถูกหักคืน",
} as const

// AF-8b (กฎ 33): ยอดต่อสถานะตามแถวของ `GET /affiliate/me/earnings` — ไม่คำนวณเงินที่ storefront
// AF-24 กฎ 48b: API หัก reversal ของ entry ที่ยัง pending ใน pending แล้ว (reversed เหลือของ approved/paid)
export default async function AffiliateEarningsPage({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  const affiliate = await getAffiliate()
  if (!affiliate) {
    redirect(`/${countryCode}/affiliate/login`)
  }
  // AF-8c กฎ 36b: backend ไม่ตอบ/5xx → affiliate-portal-error (null = 403 ตามสถานะ → status notice)
  const result = await getAffiliateEarnings().catch((error: unknown) => {
    console.error("[affiliate-portal] /affiliate/me/earnings ล้ม", error)
    return undefined
  })
  if (result === undefined) {
    return <PortalError />
  }
  const byStatus = result && earningsByStatus(result.totals)

  return (
    <div className="content-container py-8 flex flex-col gap-y-6" data-testid="affiliate-earnings-page">
      <h1 className="text-2xl leading-[36px] font-semibold">รายได้ค่าคอมมิชชัน</h1>
      {!byStatus ? (
        <StatusNotice status={affiliate.status} />
      ) : (
        <dl className="grid grid-cols-1 small:grid-cols-4 gap-4">
          {EARNING_STATUSES.map((status) => (
            <div
              key={status}
              className="flex flex-col gap-y-1 border border-border rounded-rounded p-4"
              data-testid={`affiliate-earnings-${status}`}
            >
              <dt className="text-xs leading-5 font-normal text-muted-foreground">{LABEL[status]}</dt>
              {byStatus[status].map((m) => (
                <dd key={m.currency_code} className="text-base leading-6 font-semibold">
                  {portalAmount(m)}
                </dd>
              ))}
              {status === "pending" && (
                <dd className="text-xs leading-5 font-normal text-muted-foreground" data-testid="affiliate-earnings-pending-note">
                  หักรายการยกเลิก/คืนเงินแล้ว
                </dd>
              )}
              {status === "reversed" && (
                <dd className="text-xs leading-5 font-normal text-muted-foreground" data-testid="affiliate-earnings-reversed-note">
                  ยอดที่ถูกหักจากคำสั่งซื้อที่ยกเลิกหรือคืนเงิน แสดงแยกจากยอดอื่น
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
