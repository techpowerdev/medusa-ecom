import { Metadata } from "next"

import AddVariantError from "@modules/account/components/add-variant-error"
import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { listGroupBuyMemberships } from "@lib/data/group-buy"

export const metadata: Metadata = {
  title: "บัญชีของฉัน",
  description: "ภาพรวมกิจกรรมในบัญชีของคุณ",
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function OverviewTemplate({
  params,
  searchParams,
}: Props) {
  const { countryCode } = await params
  const customer = await retrieveCustomer().catch(() => null)
  // CORE-68 (กฎข้อ 126): overview แสดง 5 ล่าสุด + ลิงก์ "ดูทั้งหมด" ไปหน้า /account/orders ที่แบ่งหน้า
  // CORE-78 (กฎข้อ 136b): "ดูทั้งหมด" แสดงด้วยเมื่อมีแต่ membership แบบกลุ่ม — CORE-92 (กฎข้อ 148b): อ่านแค่ 1 รายการพอ
  const [list, groupOrders] = await Promise.all([
    listOrders(5).catch(() => null),
    listGroupBuyMemberships(1),
  ])
  const orders = list?.orders ?? null

  if (!customer) {
    notFound()
  }

  return (
    <>
      {/* CORE-14d (กฎ 58, owner 2026-10-27): ล็อกอินอยู่แล้วเปิดลิงก์ add_variant → ปุ่มยืนยันแทนการเพิ่มเอง */}
      <AddVariantError
        countryCode={countryCode}
        searchParams={await searchParams}
        confirm
      />
      <Overview
        customer={customer}
        orders={orders}
        hasGroupOrders={(groupOrders?.memberships.length ?? 0) > 0}
      />
    </>
  )
}
