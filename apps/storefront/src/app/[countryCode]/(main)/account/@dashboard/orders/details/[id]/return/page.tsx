import { retrieveOrder } from "@lib/data/orders"
import { listReturnReasons, retrieveReturnableItems } from "@lib/data/returns"
import ReturnRequestForm from "@modules/returns/components/return-request-form"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "ขอคืนสินค้า",
  description: "ส่งคำขอคืนสินค้าจากคำสั่งซื้อของคุณ",
}

// spec 01 CORE-20 (AC-65, Q-F5): ขอคืนได้ภายใน return_window_days ของ region ของ order เฉพาะ line ที่ต้องจัดส่ง
// นอกเงื่อนไข → แสดงว่าไม่มีสินค้าที่คืนได้ (ไม่ 404 เพื่อให้ข้อความสำเร็จยังแสดงหลังส่งคำขอแล้ว)
export default async function OrderReturnPage(props: Props) {
  const { id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) {
    notFound()
  }

  const [returnable, reasons] = await Promise.all([retrieveReturnableItems(order), listReturnReasons()])
  const lines = returnable.map(({ item, quantity }) => ({
    id: item.id,
    title: item.product_title ?? item.title,
    variantTitle: item.variant_title,
    maxQuantity: quantity,
  }))

  return (
    <ReturnRequestForm
      orderId={order.id}
      displayId={order.display_id}
      lines={lines}
      reasons={reasons.map((reason) => ({ id: reason.id, label: reason.label }))}
    />
  )
}
