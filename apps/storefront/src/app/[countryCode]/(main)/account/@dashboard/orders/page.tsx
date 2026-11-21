import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import { notFound, redirect } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import { listGroupBuyMemberships } from "@lib/data/group-buy"
import { showOrdersEmptyState } from "@lib/util/group-buy-orders"
import { ORDERS_PAGE_SIZE, ordersPage, ordersTotalPages } from "@lib/util/orders-pagination"
import AccountGroupOrders from "@modules/group-buy/components/account-group-orders"
import { Pagination } from "@modules/store/components/pagination"

export const metadata: Metadata = {
  title: "คำสั่งซื้อ",
  description: "ภาพรวมคำสั่งซื้อที่ผ่านมาของคุณ",
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export default async function Orders(props: Props) {
  // CORE-68 (กฎข้อ 126): ?page= 1-based หน้าละ 10 จาก count ของ Medusa
  const { page, offset } = ordersPage((await props.searchParams).page)
  const [list, groupOrders] = await Promise.all([
    listOrders(ORDERS_PAGE_SIZE, offset),
    listGroupBuyMemberships(),
  ])

  if (!list) {
    notFound()
  }

  const { orders, count } = list
  const totalPages = ordersTotalPages(count)
  // หน้าเกินจำนวน → หน้าสุดท้าย
  if (page > totalPages) {
    const { countryCode } = await props.params
    const last = totalPages > 1 ? `?page=${totalPages}` : ""
    redirect(`/${countryCode}/account/orders${last}`)
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
      {/* GB-12 (กฎข้อ 32e + คำตัดสิน owner): empty state เฉพาะเมื่อรู้แน่ว่าไม่มีทั้ง order ปกติและแบบกลุ่ม (GB-8 ล้ม → ไม่แสดง) */}
      {(orders.length > 0 || showOrdersEmptyState(orders, groupOrders)) && (
        <div>
          <OrderOverview orders={orders} />
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} data-testid="orders-pagination" />
          )}
        </div>
      )}
    </div>
  )
}
