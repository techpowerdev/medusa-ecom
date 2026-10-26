import { retrieveOrder } from "@lib/data/orders"
import { listReturnReasons } from "@lib/data/returns"
import { getStorePolicies } from "@lib/data/store-policies"
import { canRequestReturn, returnableItems } from "@lib/util/return-request"
import ReturnRequestForm from "@modules/returns/components/return-request-form"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string; id: string }>
}

export const metadata: Metadata = {
  title: "ขอคืนสินค้า",
  description: "ส่งคำขอคืนสินค้าจากคำสั่งซื้อของคุณ",
}

// spec 01 CORE-20 (AC-65, Q-F5): ขอคืนได้ภายใน return_window_days ของ region เฉพาะ line ที่ต้องจัดส่ง
// นอกเงื่อนไข → แสดงว่าไม่มีสินค้าที่คืนได้ (ไม่ 404 เพื่อให้ข้อความสำเร็จยังแสดงหลังส่งคำขอแล้ว)
export default async function OrderReturnPage(props: Props) {
  const { countryCode, id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) {
    notFound()
  }

  const [policies, reasons] = await Promise.all([getStorePolicies(countryCode), listReturnReasons()])
  const lines = canRequestReturn(order, policies.current?.returnWindowDays)
    ? returnableItems(order.items).map(({ item, quantity }) => ({
        id: item.id,
        title: item.product_title ?? item.title,
        variantTitle: item.variant_title,
        maxQuantity: quantity,
      }))
    : []

  return (
    <ReturnRequestForm
      orderId={order.id}
      displayId={order.display_id}
      lines={lines}
      reasons={reasons.map((reason) => ({ id: reason.id, label: reason.label }))}
    />
  )
}
