import { affiliateLogout, getAffiliate } from "@lib/data/affiliate-portal"
import PortalError from "@modules/affiliate/components/portal-error"
import PortalNav from "@modules/affiliate/components/portal-nav"

// AF-8b (spec 05 กฎ 33): layout ของ portal — หัว (ชื่อ, รหัสแนะนำ, ออกจากระบบ) + แถบนำทาง เมื่อ login แล้ว
// ยังไม่ login (หน้า login) แสดงเฉพาะเนื้อหา; แต่ละหน้า redirect ไป login เอง
export default async function AffiliatePortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  // AF-8c กฎ 36b: backend ไม่ตอบ/5xx ที่ `/affiliate/me` → render affiliate-portal-error จาก server แทนเนื้อหา
  // (401 → getAffiliate คืน null แล้วหน้า redirect ไป login ตามเดิม)
  let affiliate: Awaited<ReturnType<typeof getAffiliate>>
  try {
    affiliate = await getAffiliate()
  } catch {
    return <PortalError />
  }
  if (!affiliate) {
    return children
  }

  return (
    <>
      <div className="content-container pt-12 flex flex-col gap-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p>
            {affiliate.name} · รหัสแนะนำ <span data-testid="affiliate-code">{affiliate.code}</span>
          </p>
          <form action={affiliateLogout}>
            <input type="hidden" name="countryCode" value={countryCode} />
            <button type="submit" className="underline" data-testid="affiliate-logout">
              ออกจากระบบ
            </button>
          </form>
        </div>
        <PortalNav countryCode={countryCode} />
      </div>
      {children}
    </>
  )
}
