import { Metadata } from "next"

import AddVariantError from "@modules/account/components/add-variant-error"
import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"

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
  const orders = (await listOrders().catch(() => null)) || null

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
      <Overview customer={customer} orders={orders} />
    </>
  )
}
