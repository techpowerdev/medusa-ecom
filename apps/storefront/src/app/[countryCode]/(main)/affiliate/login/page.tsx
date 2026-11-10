import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getAffiliate } from "@lib/data/affiliate-portal"
import AffiliateAuthForms from "@modules/affiliate/components/auth-forms"

export const metadata: Metadata = {
  title: "เข้าสู่ระบบแอฟฟิลิเอต",
  robots: { index: false },
}

export default async function AffiliateLoginPage({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  if (await getAffiliate()) {
    redirect(`/${countryCode}/affiliate`)
  }

  return (
    <div className="content-container py-12" data-testid="affiliate-login-page">
      <AffiliateAuthForms countryCode={countryCode} />
    </div>
  )
}
