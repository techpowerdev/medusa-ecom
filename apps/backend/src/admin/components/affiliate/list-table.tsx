import { DataTable } from "@medusajs/dashboard/components"
import { useQueryParams } from "@medusajs/dashboard/hooks"
import { DataTableColumnDef, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { affiliateKeys, listAffiliateNames, listAffiliateResource } from "../../lib/affiliate"
import { affiliateNamesQuery, withAffiliateNames } from "../../lib/affiliate-names"
import { pageOffset } from "../../lib/group-buy-campaign"

const PAGE_SIZE = 20

type Resource = "programs" | "affiliates" | "entries" | "payouts"

/**
 * AF-6 / ADM-8a (spec 08 กฎ 9): รายการของแท็บหนึ่งในหน้า Affiliate (เรียง created_at ใหม่สุดก่อนตามค่าเริ่มต้นของ AF-5)
 * หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset`) — DataTable ของ dashboard เขียน, useQueryParams อ่านกลับเพื่อ request
 */
export const useAffiliateList = <T extends { id: string }>(resource: Resource, prefix: string) => {
  const { offset: offsetParam } = useQueryParams(["offset"], prefix)
  const offset = pageOffset(offsetParam)

  // DataTable ของ dashboard parseInt ค่า offset ดิบเอง ("abc" → "NaN of N results") → แก้ URL เป็นค่าที่ใช้จริง (แบบหน้า group buy)
  const [, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (offsetParam === undefined || offsetParam === String(offset)) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (offset) next.set(`${prefix}_offset`, String(offset))
        else next.delete(`${prefix}_offset`)
        return next
      },
      { replace: true },
    )
  }, [offsetParam, offset, prefix, setSearchParams])

  const { data, isLoading } = useQuery({
    queryKey: [...affiliateKeys.list(resource), PAGE_SIZE, offset],
    queryFn: () => listAffiliateResource<Resource, T>(resource, { limit: PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
  })

  return { rows: data?.[resource] ?? [], count: data?.count ?? 0, isLoading, prefix }
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
  /** prefix ของ query param ใน URL — ไม่ซ้ำกันในหน้าเดียว (กฎ 9) */
  prefix: string
  columns: DataTableColumnDef<T, any>[]
  /** หัวตารางในแถว toolbar ของ DataTable (แท็บที่มีปุ่ม Create ใช้ Header แทนเพราะ `action` ใส่ data-testid ไม่ได้) */
  heading?: string
  subHeading?: string
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
  empty,
}: Props<T>) => (
  // backend ไม่รองรับค้นหา (q) → ปิด search
  <DataTable
    data={rows}
    columns={columns}
    getRowId={(row) => row.id}
    rowCount={count}
    isLoading={isLoading}
    heading={heading}
    headingLevel="h2"
    subHeading={subHeading}
    prefix={prefix}
    pageSize={PAGE_SIZE}
    enableSearch={false}
    emptyState={{ empty: { heading: empty } }}
  />
)

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
