import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import { notFound } from "next/navigation"
import { listOrders } from "@lib/data/orders"

export const metadata: Metadata = {
  title: "คำสั่งซื้อ",
  description: "ภาพรวมคำสั่งซื้อที่ผ่านมาของคุณ",
}

export default async function Orders() {
  const orders = await listOrders()

  if (!orders) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4" data-testid="account-page-header">
        <h1 className="text-2xl-semi">คำสั่งซื้อ</h1>
        <p className="text-base-regular">
          ดูคำสั่งซื้อที่ผ่านมาและสถานะ รวมถึงขอคืนหรือเปลี่ยนสินค้าได้หากต้องการ
        </p>
      </div>
      <div>
        <OrderOverview orders={orders} />
      </div>
    </div>
  )
}
