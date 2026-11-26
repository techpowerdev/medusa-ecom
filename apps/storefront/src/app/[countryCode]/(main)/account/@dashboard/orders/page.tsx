import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import { notFound, redirect } from "next/navigation"
import { listOrders } from "@lib/data/orders"
import { listGroupBuyMemberships } from "@lib/data/group-buy"
import { showOrdersEmptyState } from "@lib/util/group-buy-orders"
import { pageFromSearchParam, totalPages as pageCount } from "@lib/util/pagination"
import AccountGroupOrders from "@modules/group-buy/components/account-group-orders"
import { Pagination } from "@modules/store/components/pagination"

export const metadata: Metadata = {
  title: "คำสั่งซื้อ",
  description: "ภาพรวมคำสั่งซื้อที่ผ่านมาของคุณ",
}

// CORE-68 (กฎข้อ 126): หน้าละ 10
const ORDERS_PAGE_SIZE = 10

// GB-7b: เวลาของ request ใช้ตัดสินสถานะ — CORE-92 (กฎข้อ 148d): อ่านคู่กับข้อมูล GB-8 นอก render (กฎ react-hooks/purity ไม่ต้องปิด)
const loadGroupOrders = async () => ({ data: await listGroupBuyMemberships(), now: Date.now() })

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ page?: string | string[] }>
}

export default async function Orders(props: Props) {
  // CORE-68 (กฎข้อ 126): ?page= 1-based หน้าละ 10 จาก count ของ Medusa
  const { page, offset } = pageFromSearchParam((await props.searchParams).page, ORDERS_PAGE_SIZE)
  // CORE-78 (กฎข้อ 136a): ส่วนคำสั่งซื้อแบบกลุ่มอยู่เฉพาะหน้า 1 — หน้าอื่นไม่ต้องอ่าน GB-8
  const [list, groupOrders] = await Promise.all([
    listOrders(ORDERS_PAGE_SIZE, offset),
    page === 1 ? loadGroupOrders() : null,
  ])

  if (!list) {
    notFound()
  }

  const { orders, count } = list
  const totalPages = pageCount(count, ORDERS_PAGE_SIZE)
  // หน้าเกินจำนวน → หน้าสุดท้าย
  if (page > totalPages) {
    const { countryCode } = await props.params
    const last = totalPages > 1 ? `?page=${totalPages}` : ""
    redirect(`/${countryCode}/account/orders${last}`)
  }

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4" data-testid="account-page-header">
        <h1 className="text-[30px] leading-[48px] font-semibold">คำสั่งซื้อ</h1>
        <p className="text-sm leading-6 font-normal">
          ดูคำสั่งซื้อที่ผ่านมาและสถานะ รวมถึงขอคืนหรือเปลี่ยนสินค้าได้หากต้องการ
        </p>
      </div>
      {groupOrders && <AccountGroupOrders data={groupOrders.data} now={groupOrders.now} />}
      {/* GB-12 (กฎข้อ 32e + คำตัดสิน owner): empty state เฉพาะเมื่อรู้แน่ว่าไม่มีทั้ง order ปกติและแบบกลุ่ม (GB-8 ล้ม → ไม่แสดง) */}
      {(orders.length > 0 || showOrdersEmptyState(orders, groupOrders?.data ?? null)) && (
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
