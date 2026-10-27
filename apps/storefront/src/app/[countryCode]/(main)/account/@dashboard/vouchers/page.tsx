import { Metadata } from "next"

import { listCustomerEvouchers } from "@lib/data/evouchers"
import VoucherCard from "@modules/evoucher/components/voucher-card"

export const metadata: Metadata = {
  title: "บัตรกำนัลของฉัน",
  description: "รหัสบัตรกำนัลที่ได้รับจากคำสั่งซื้อของคุณ",
}

// EV-7b (spec 02 กฎข้อ 22, AC-6): code/PIN ของลูกค้า — render ใหม่ทุกครั้ง ไม่ cache
export const dynamic = "force-dynamic"

export default async function Vouchers() {
  const { evouchers } = await listCustomerEvouchers()

  return (
    <div className="w-full" data-testid="vouchers-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4" data-testid="account-page-header">
        <h1 className="text-2xl-semi">บัตรกำนัลของฉัน</h1>
        <p className="text-base-regular">
          รหัสบัตรกำนัลจากคำสั่งซื้อของคุณ คัดลอกรหัสไปใช้ตามวิธีใช้ของพาร์ทเนอร์แต่ละราย
        </p>
      </div>
      {evouchers.length ? (
        <ul className="flex flex-col gap-y-4">
          {evouchers.map((voucher) => (
            <VoucherCard key={voucher.id} voucher={voucher} />
          ))}
        </ul>
      ) : (
        <p className="text-base-regular text-ui-fg-subtle" data-testid="vouchers-empty">
          ยังไม่มีบัตรกำนัล
        </p>
      )}
    </div>
  )
}
