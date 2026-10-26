import { Metadata } from "next"

import { getStorePolicies } from "@lib/data/store-policies"
import {
  PoliciesUnavailable,
  PolicyPage,
  ShippingSummary,
} from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "ข้อมูลการจัดส่ง",
  description: "อัตราค่าจัดส่งและระยะเวลาจัดส่ง",
}

export default async function ShippingPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const { current, currencyCode } = await getStorePolicies(countryCode)

  return (
    <PolicyPage title="ข้อมูลการจัดส่ง">
      {current ? (
        <>
          <p>อัตราค่าจัดส่งและระยะเวลาจัดส่งของคำสั่งซื้อในภูมิภาคนี้มีดังนี้</p>
          <ShippingSummary policies={current} currencyCode={currencyCode} />
          <p className="text-ui-fg-subtle">
            วิธีจัดส่งที่เลือกได้และค่าจัดส่งสุดท้ายจะแสดงในขั้นตอนชำระเงิน
          </p>
        </>
      ) : (
        <PoliciesUnavailable />
      )}
    </PolicyPage>
  )
}
