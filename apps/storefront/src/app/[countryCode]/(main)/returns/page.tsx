import { Metadata } from "next"

import { getStorePolicies } from "@lib/data/store-policies"
import { PoliciesUnavailable, PolicyPage } from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "นโยบายการคืนสินค้า",
  description: "วิธีคืนสินค้าและขอคืนเงิน",
}

export default async function ReturnsPage(props: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const { current } = await getStorePolicies(countryCode)

  return (
    <PolicyPage title="นโยบายการคืนสินค้า">
      {current ? (
        <>
          <p>
            คุณสามารถคืนสินค้าได้ภายใน {current.returnWindowDays} วัน
            หลังได้รับสินค้า โดยส่งคืนทางไปรษณีย์
          </p>
          <p>
            {current.freeReturns
              ? "ไม่มีค่าจัดส่งสำหรับการคืนสินค้า"
              : "ลูกค้าเป็นผู้ชำระค่าจัดส่งสำหรับการคืนสินค้า"}
          </p>
        </>
      ) : (
        <PoliciesUnavailable />
      )}
    </PolicyPage>
  )
}
