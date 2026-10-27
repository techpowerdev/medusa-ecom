import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getAffiliate, listAffiliateProducts } from "@lib/data/affiliate-portal"
import { portalPage, portalTab } from "@lib/util/affiliate-portal"
import { clx } from "@modules/common/components/ui"
import AffiliateProductCard from "@modules/affiliate/components/product-card"
import PortalError from "@modules/affiliate/components/portal-error"
import StatusNotice from "@modules/affiliate/components/status-notice"

export const metadata: Metadata = {
  title: "แอฟฟิลิเอต",
  robots: { index: false },
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ tab?: string | string[]; page?: string | string[] }>
}

const TABS = [
  { tab: "active", label: "ได้ค่าคอมมิชชันตอนนี้", testId: "affiliate-tab-earning" },
  { tab: "upcoming", label: "เร็วๆ นี้", testId: "affiliate-tab-upcoming" },
] as const

// AF-8a (spec 05 Storefront): หน้าแรกของ portal = Products สองแท็บ (กฎ 29 การ์ดเดียวต่อสินค้า — API ทำ dedupe)
export default async function AffiliatePortalPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const query = await searchParams
  const affiliate = await getAffiliate()
  if (!affiliate) {
    redirect(`/${countryCode}/affiliate/login`)
  }
  const tab = portalTab(query.tab)
  const page = portalPage(query.page)
  // Q6: products เฉพาะ active — สถานะอื่นไม่เรียก API (จะได้ 403) แสดง affiliate-status-notice (AF-8b กฎ 33)
  // AF-8c กฎ 36b: backend ไม่ตอบ/5xx → affiliate-portal-error
  const result = affiliate.status === "active" ? await listAffiliateProducts(tab, page).catch(() => undefined) : null
  if (result === undefined) {
    return <PortalError />
  }
  const base = `/${countryCode}/affiliate?tab=${tab}`

  return (
    <div className="content-container py-12 flex flex-col gap-y-6" data-testid="affiliate-portal-page">
      {!result && <StatusNotice status={affiliate.status} />}

      {result && (
        <>
          <nav className="flex gap-x-6 border-b border-ui-border-base">
            {TABS.map((t) => (
              <Link
                key={t.tab}
                href={`/${countryCode}/affiliate?tab=${t.tab}`}
                aria-current={t.tab === tab ? "page" : undefined}
                className={clx("pb-2", t.tab === tab && "border-b-2 border-ui-fg-base font-semibold")}
                data-testid={t.testId}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {result.products.length ? (
            <ul className="grid grid-cols-2 small:grid-cols-4 gap-6">
              {result.products.map((item) => (
                <AffiliateProductCard key={item.product.id} item={item} tab={tab} />
              ))}
            </ul>
          ) : (
            <p data-testid="affiliate-products-empty">ยังไม่มีสินค้าในแท็บนี้</p>
          )}
          <div className="flex gap-x-6">
            {page > 1 && <Link href={`${base}&page=${page - 1}`}>หน้าก่อน</Link>}
            {page * result.limit < result.count && <Link href={`${base}&page=${page + 1}`}>หน้าถัดไป</Link>}
          </div>
        </>
      )}
    </div>
  )
}
