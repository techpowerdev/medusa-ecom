import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import { notFound } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import { listGroupBuyMemberships } from "@lib/data/group-buy"
import AccountGroupOrders from "@modules/group-buy/components/account-group-orders"

export const metadata: Metadata = {
  title: "คำสั่งซื้อ",
  description: "ภาพรวมคำสั่งซื้อที่ผ่านมาของคุณ",
}

export default async function Orders() {
  const [orders, groupOrders] = await Promise.all([listOrders(), listGroupBuyMemberships()])

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
      {/* GB-7b: เวลาของ request ใช้ตัดสินสถานะ (server component render ครั้งเดียวต่อ request) */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <AccountGroupOrders data={groupOrders} now={Date.now()} />
      {/* GB-12 (กฎข้อ 32e): empty state ของ OrderOverview เฉพาะเมื่อไม่มีทั้ง order ปกติและคำสั่งซื้อแบบกลุ่ม */}
      {(orders.length > 0 || !groupOrders?.memberships.length) && (
        <div>
          <OrderOverview orders={orders} />
        </div>
      )}
    </div>
  )
}
