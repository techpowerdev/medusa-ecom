import { Metadata } from "next"
import { notFound } from "next/navigation"

import { retrievePublicGroup } from "@lib/data/group-buy"
import { listProducts } from "@lib/data/products"
import { groupSharePath } from "@lib/util/group-page"
import { getSiteOrigin } from "@lib/util/site"
import GroupPage from "@modules/group-buy/components/group-page"

// GB-7a1 (spec 04 กฎข้อ 29b): หน้ากลุ่มสาธารณะ อ่าน GB-11 แบบ no-store ทุกครั้งที่โหลด — ลิงก์ของทีมไม่ควรถูก index
export const metadata: Metadata = {
  title: "ซื้อกลุ่ม",
  description: "ดูความคืบหน้าของกลุ่มซื้อและแชร์ลิงก์ให้เพื่อน",
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ countryCode: string; token: string }> }

export default async function GroupTokenPage(props: Props) {
  const { countryCode, token } = await props.params
  const view = await retrievePublicGroup(token)
  if (!view) {
    notFound()
  }

  const productId = view.campaign.product_id
  const [product, origin] = await Promise.all([
    productId
      ? listProducts({ countryCode, queryParams: { id: [productId], limit: 1 } })
          .then(({ response }) => response.products[0] ?? null)
          .catch(() => null)
      : null,
    getSiteOrigin(),
  ])

  return (
    <GroupPage
      view={view}
      product={product}
      shareUrl={`${origin}${groupSharePath(token)}`}
      // เวลาของ request ใช้เริ่มนับถอยหลัง (server component render ครั้งเดียวต่อ request)
      // eslint-disable-next-line react-hooks/purity
      now={Date.now()}
    />
  )
}
