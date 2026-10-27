import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getAffiliate, listAffiliatePayouts } from "@lib/data/affiliate-portal"
import { portalPage } from "@lib/util/affiliate-portal"
import { formatDate } from "@lib/util/date"
import { convertToLocale } from "@lib/util/money"
import Pager from "@modules/affiliate/components/pager"
import StatusNotice from "@modules/affiliate/components/status-notice"

export const metadata: Metadata = { title: "การจ่ายเงินแอฟฟิลิเอต", robots: { index: false } }

const STATUS_LABEL = { draft: "รอจ่าย", paid: "จ่ายแล้ว" } as const

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

// AF-8b (กฎ 33): payout ของตัวเองจาก `GET /affiliate/me/payouts` — งวด, ยอด, สถานะ, วันที่จ่าย (ไม่มี reference ตาม Q14)
export default async function AffiliatePayoutsPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const affiliate = await getAffiliate()
  if (!affiliate) {
    redirect(`/${countryCode}/affiliate/login`)
  }
  const page = portalPage((await searchParams).page)
  const result = await listAffiliatePayouts(page)

  return (
    <div className="content-container py-8 flex flex-col gap-y-6" data-testid="affiliate-payouts-page">
      <h1 className="text-xl-semi">การจ่ายเงิน</h1>
      {!result ? (
        <StatusNotice status={affiliate.status} />
      ) : result.payouts.length ? (
        <table className="w-full text-left">
          <thead>
            <tr className="text-small-regular text-ui-fg-subtle">
              <th>งวด</th>
              <th>ยอด</th>
              <th>สถานะ</th>
              <th>วันที่จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {result.payouts.map((p) => (
              <tr key={p.id} className="border-t border-ui-border-base" data-testid="affiliate-payout-row">
                <td>
                  {formatDate(p.period_from)} – {formatDate(p.period_to)}
                </td>
                <td>{convertToLocale({ amount: p.amount, currency_code: p.currency })}</td>
                <td>{STATUS_LABEL[p.status]}</td>
                <td>{p.paid_at ? formatDate(p.paid_at) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p data-testid="affiliate-payouts-empty">ยังไม่มีรายการจ่ายเงิน</p>
      )}
      {result && <Pager href={`/${countryCode}/affiliate/payouts`} page={page} limit={result.limit} count={result.count} />}
    </div>
  )
}
