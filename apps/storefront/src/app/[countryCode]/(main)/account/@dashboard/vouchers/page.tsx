import { Metadata } from "next"
import Link from "next/link"

import { listCustomerEvouchers } from "@lib/data/evouchers"
import {
  VOUCHERS_PAGE_SIZE,
  vouchersHasNext,
  vouchersPagination,
} from "@lib/util/evoucher"
import VoucherCard from "@modules/evoucher/components/voucher-card"

export const metadata: Metadata = {
  title: "บัตรกำนัลของฉัน",
  description: "รหัสบัตรกำนัลที่ได้รับจากคำสั่งซื้อของคุณ",
}

// EV-7b (spec 02 กฎข้อ 22, AC-6): code/PIN ของลูกค้า — render ใหม่ทุกครั้ง ไม่ cache
export const dynamic = "force-dynamic"

type Props = {
  searchParams: Promise<{ page?: string | string[] }>
}

export default async function Vouchers(props: Props) {
  // EV-7e (กฎข้อ 29a): หน้าละ 20 รายการตาม `?page=` — ไม่ตัดที่ 100
  const pagination = vouchersPagination((await props.searchParams).page)
  const { evouchers, count } = await listCustomerEvouchers(
    VOUCHERS_PAGE_SIZE,
    pagination.offset
  )
  const hasPrev = pagination.page > 1
  const hasNext = vouchersHasNext(pagination, count)

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
      {(hasPrev || hasNext) && (
        <nav
          aria-label="แบ่งหน้าบัตรกำนัล"
          className="mt-8 flex items-center justify-between text-small-regular"
          data-testid="vouchers-pagination"
        >
          {hasPrev ? (
            <Link
              href={`?page=${pagination.page - 1}`}
              className="underline"
              data-testid="vouchers-prev"
            >
              หน้าก่อนหน้า
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ui-fg-subtle">หน้า {pagination.page}</span>
          {hasNext ? (
            <Link
              href={`?page=${pagination.page + 1}`}
              className="underline"
              data-testid="vouchers-next"
            >
              หน้าถัดไป
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
