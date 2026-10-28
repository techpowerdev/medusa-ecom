import { retrieveCustomer } from "@lib/data/customer"
import { retrieveGroupBuyOrder } from "@lib/data/group-buy"
import OrderPay from "@modules/order/components/order-pay"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "ชำระเงินคำสั่งซื้อ",
}

// PAY-3b (spec 06 กฎข้อ 9): ลิงก์ชำระเงินในอีเมลของ GB-4 — อ่านจาก route ของ GB-8 เท่านั้น
export default async function OrderPayPage(props: Props) {
  const { id } = await props.params
  // ยังไม่ login → layout ของ account แสดงหน้า login แทน slot นี้ (ไม่มี guest)
  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) {
    return null
  }

  const data = await retrieveGroupBuyOrder(id)
  if (!data) {
    notFound()
  }

  // server component render ครั้งเดียวต่อ request — เวลาของ request ใช้ render แรก (client ใช้นาฬิกาของตัวเองหลัง hydrate)
  // eslint-disable-next-line react-hooks/purity
  return <OrderPay initial={data} serverNow={Date.now()} />
}
