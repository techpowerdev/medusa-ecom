import { DataTable, DataTableColumnDef, DataTablePaginationState, Text, useDataTable } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { affiliateKeys, listAffiliateNames, listAffiliateResource } from "../../lib/affiliate"
import { affiliateNamesQuery, withAffiliateNames } from "../../lib/affiliate-names"

type Props<T extends { id: string }> = {
  /** path ใต้ /admin/affiliate/ และ key ของรายการใน response (programs, affiliates, entries, payouts) */
  resource: "programs" | "affiliates" | "entries" | "payouts"
  columns: DataTableColumnDef<T, any>[]
  empty: string
  /** AF-14 (กฎ 38): แถวมี affiliate_id → ดึงชื่อ/อีเมลของแถวในหน้านี้ 1 request แล้วแนบเป็น `row.affiliate` */
  affiliateNames?: boolean
}

// AF-6: ตารางรายการของแต่ละแท็บในหน้า Affiliate (เรียง created_at ใหม่สุดก่อนตามค่าเริ่มต้นของ AF-5)
export const AffiliateListTable = <T extends { id: string }>({
  resource,
  columns,
  empty,
  affiliateNames = false,
}: Props<T>) => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [...affiliateKeys.list(resource), limit, offset],
    queryFn: () => listAffiliateResource<typeof resource, T>(resource, { limit, offset }),
    placeholderData: keepPreviousData,
  })

  // affiliateNames ใช้กับ resource ที่แถวมี affiliate_id เท่านั้น (entries, payouts)
  const namesQuery = affiliateNames
    ? affiliateNamesQuery((data?.[resource] ?? []) as unknown as { affiliate_id: string }[])
    : null
  const names = useQuery({
    queryKey: [...affiliateKeys.list("affiliates"), "names", namesQuery?.id],
    queryFn: () => listAffiliateNames(namesQuery!),
    enabled: !!namesQuery,
  })
  const tableRows = useMemo(() => {
    const rows = data?.[resource] ?? []
    return affiliateNames
      ? (withAffiliateNames(rows as (T & { affiliate_id: string })[], names.data?.affiliates) as T[])
      : rows
  }, [data, resource, names.data, affiliateNames])

  const table = useDataTable({
    data: tableRows,
    columns,
    getRowId: (row) => row.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <DataTable instance={table}>
      <DataTable.Table emptyState={{ empty: { heading: empty } }} />
      <DataTable.Pagination />
    </DataTable>
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
