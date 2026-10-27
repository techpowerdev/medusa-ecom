import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getAffiliate, listAffiliatePrograms } from "@lib/data/affiliate-portal"
import { portalPage } from "@lib/util/affiliate-portal"
import { formatDate } from "@lib/util/date"
import Pager from "@modules/affiliate/components/pager"
import PortalError from "@modules/affiliate/components/portal-error"
import StatusNotice from "@modules/affiliate/components/status-notice"

export const metadata: Metadata = { title: "โปรแกรมแอฟฟิลิเอต", robots: { index: false } }

const STATE_LABEL = { active: "กำลังดำเนินการ", upcoming: "เร็วๆ นี้" } as const

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

// AF-8b (กฎ 33): โปรแกรม published ที่ active/upcoming จาก `GET /affiliate/me/programs`
export default async function AffiliateProgramsPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const affiliate = await getAffiliate()
  if (!affiliate) {
    redirect(`/${countryCode}/affiliate/login`)
  }
  const page = portalPage((await searchParams).page)
  // AF-8c กฎ 36b: backend ไม่ตอบ/5xx → affiliate-portal-error (null = 403 ตามสถานะ → status notice)
  const result = await listAffiliatePrograms(page).catch((error: unknown) => {
    console.error("[affiliate-portal] /affiliate/me/programs ล้ม", error)
    return undefined
  })
  if (result === undefined) {
    return <PortalError />
  }

  return (
    <div className="content-container py-8 flex flex-col gap-y-6" data-testid="affiliate-programs-page">
      <h1 className="text-xl-semi">โปรแกรมค่าคอมมิชชัน</h1>
      {!result ? (
        <StatusNotice status={affiliate.status} />
      ) : result.programs.length ? (
        <ul className="flex flex-col gap-y-4">
          {result.programs.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-y-1 border border-ui-border-base rounded-rounded p-4"
              data-testid="affiliate-program-row"
              data-state={p.state}
            >
              <div className="flex flex-wrap items-center gap-x-3">
                <span className="text-base-semi">{p.name}</span>
                <span className="text-small-regular rounded-full bg-ui-bg-subtle px-2" data-testid="affiliate-program-state">
                  {STATE_LABEL[p.state]}
                </span>
              </div>
              <p>ค่าคอมมิชชัน {p.commission_value}%</p>
              <p className="text-small-regular text-ui-fg-subtle">
                {formatDate(p.starts_at)} – {formatDate(p.ends_at)}
              </p>
              {p.announce_text && <p className="text-small-regular">{p.announce_text}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="affiliate-programs-empty">ยังไม่มีโปรแกรมที่เปิดหรือกำลังจะเปิด</p>
      )}
      {result && <Pager href={`/${countryCode}/affiliate/programs`} page={page} limit={result.limit} count={result.count} />}
    </div>
  )
}
