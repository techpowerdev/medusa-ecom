import { DataTable } from "@medusajs/dashboard/components"
import { DataTableColumnDef, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { affiliateKeys, listAffiliateNames, listAffiliateResource } from "../../lib/affiliate"
import { affiliateNamesQuery, withAffiliateNames } from "../../lib/affiliate-names"
import { isUnauthorized } from "../../lib/fetch-error"
import { usePageOffset } from "../common/use-page-offset"
import { PageOffsetGate } from "../common/page-offset-gate"

const PAGE_SIZE = 20

type Resource = "programs" | "affiliates" | "entries" | "payouts"

/**
 * AF-6 / ADM-8a (spec 08 กฎ 9): รายการของแท็บหนึ่งในหน้า Affiliate (เรียง created_at ใหม่สุดก่อนตามค่าเริ่มต้นของ AF-5)
 * หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset`) — DataTable ของ dashboard เขียน, usePageOffset อ่านกลับเพื่อ request (กฎ 13)
 */
export const useAffiliateList = <T extends { id: string }>(resource: Resource, prefix: string) => {
  const [count, setCount] = useState<number>()
  const offset = usePageOffset(prefix, PAGE_SIZE, { count })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...affiliateKeys.list(resource), PAGE_SIZE, offset],
    queryFn: () => listAffiliateResource<Resource, T>(resource, { limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])
  // spec 08 กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  return { rows: data?.[resource] ?? [], count: data?.count ?? 0, isLoading, prefix, loadFailed, error, resource }
}

/** AF-14 (spec 05 กฎ 38): แถวมี affiliate_id → ดึงชื่อ/อีเมลของแถวในหน้านี้ 1 request แล้วแนบเป็น `row.affiliate` */
export const useAffiliateNames = <T extends { affiliate_id: string }>(rows: T[]) => {
  const query = affiliateNamesQuery(rows)
  const names = useQuery({
    queryKey: [...affiliateKeys.list("affiliates"), "names", query?.id],
    queryFn: () => listAffiliateNames(query!),
    enabled: !!query,
    // เปลี่ยนหน้าแล้วคงชื่อของหน้าก่อนไว้ระหว่างโหลด (แถวใหม่ที่ยังไม่มีชื่อแสดง affiliate_id) — nit #187
    placeholderData: keepPreviousData,
  })
  return useMemo(() => withAffiliateNames(rows, names.data?.affiliates), [rows, names.data])
}

type Props<T extends { id: string }> = {
  rows: T[]
  count: number
  isLoading: boolean
  /** กฎ 25: query รายการล้มและไม่มีข้อมูลในมือ — `error`/`resource` ใช้แสดงข้อความ error (ผู้เรียก spread จาก `useAffiliateList`) */
  loadFailed: boolean
  error: Error | null
  resource: Resource
  /** prefix ของ query param ใน URL — ไม่ซ้ำกันในหน้าเดียว (กฎ 9) */
  prefix: string
  columns: DataTableColumnDef<T, any>[]
  /** หัวตารางและปุ่มสร้างในแถว toolbar ของ DataTable — `action` ใส่ data-testid ไม่ได้ ผู้เรียกห่อตารางด้วย wrapper testid (spec 08 กฎ 18) */
  heading?: string
  subHeading?: string
  action?: { label: string; onClick: () => void }
  empty: string
}

export const AffiliateListTable = <T extends { id: string }>({
  rows,
  count,
  isLoading,
  prefix,
  columns,
  heading,
  subHeading,
  action,
  empty,
  loadFailed,
  error,
  resource,
}: Props<T>) => {
  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง + ปุ่มใน action; testid เฉพาะตอนล้ม
  // backend ไม่รองรับค้นหา (q) → ปิด search
  return (
    <div data-testid={loadFailed ? "affiliate-list-error" : undefined}>
      <PageOffsetGate prefix={prefix}>
        <DataTable
          data={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowCount={count}
          isLoading={isLoading}
          heading={heading}
          headingLevel="h2"
          subHeading={subHeading}
          action={action}
          prefix={prefix}
          pageSize={PAGE_SIZE}
          enableSearch={false}
          emptyState={{
            empty: loadFailed ? { heading: `Could not load ${resource}`, description: error?.message } : { heading: empty },
          }}
        />
      </PageOffsetGate>
    </div>
  )
}

/** AF-14 (กฎ 38): คอลัมน์ Affiliate ของ Ledger/Payouts — ชื่อ + อีเมล; หาไม่เจอ/ยังโหลดไม่เสร็จ → affiliate_id */
export const AffiliateCell = ({
  row,
}: {
  row: { affiliate_id: string; affiliate?: { name: string; email: string } }
}) =>
  row.affiliate ? (
    <div className="flex flex-col" data-testid="affiliate-row-affiliate">
      <Text size="small">{row.affiliate.name}</Text>
      <Text size="small" className="text-ui-fg-subtle">
        {row.affiliate.email}
      </Text>
    </div>
  ) : (
    <span data-testid="affiliate-row-affiliate">{row.affiliate_id}</span>
  )
