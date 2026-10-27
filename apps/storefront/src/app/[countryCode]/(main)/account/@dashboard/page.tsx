import { Metadata } from "next"

import AddVariantError from "@modules/account/components/add-variant-error"
import Overview from "@modules/account/components/overview"
import { notFound, redirect } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { pendingAddRedirectPath } from "@lib/util/pending-add-to-cart"

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
  const query = await searchParams
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    notFound()
  }

  // CORE-14d (กฎ 58): ล็อกอินอยู่แล้วเปิด /account?add_variant=… → เพิ่มลง cart แล้วไป /cart (ไม่เงียบ)
  const addPath = pendingAddRedirectPath(countryCode, query)
  if (addPath) {
    redirect(addPath)
  }

  const orders = (await listOrders().catch(() => null)) || null

  return (
    <>
      <AddVariantError countryCode={countryCode} searchParams={query} />
      <Overview customer={customer} orders={orders} />
    </>
  )
}
