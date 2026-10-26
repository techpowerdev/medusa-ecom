import { retrieveOrder } from "@lib/data/orders"
import { getStorePolicies } from "@lib/data/store-policies"
import { canRequestReturn } from "@lib/util/return-request"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ countryCode: string; id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  return {
    title: `คำสั่งซื้อ #${order.display_id}`,
    description: `ดูรายละเอียดคำสั่งซื้อของคุณ`,
  }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  // CORE-20: ปุ่มขอคืนสินค้าเฉพาะ order ที่ส่งแล้วและยังอยู่ใน return_window_days
  const policies = await getStorePolicies(params.countryCode)
  const canReturn = canRequestReturn(order, policies.current?.returnWindowDays)

  return <OrderDetailsTemplate order={order} canReturn={canReturn} />
}
