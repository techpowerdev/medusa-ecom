import { DataTable, DataTableColumnDef, DataTablePaginationState, useDataTable } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { affiliateKeys, listAffiliateResource } from "../../lib/affiliate"

type Props<T extends { id: string }> = {
  /** path ใต้ /admin/affiliate/ และ key ของรายการใน response (programs, affiliates, entries, payouts) */
  resource: "programs" | "affiliates" | "entries" | "payouts"
  columns: DataTableColumnDef<T, any>[]
  empty: string
}

// AF-6: ตารางรายการของแต่ละแท็บในหน้า Affiliate (เรียง created_at ใหม่สุดก่อนตามค่าเริ่มต้นของ AF-5)
export const AffiliateListTable = <T extends { id: string }>({ resource, columns, empty }: Props<T>) => {
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

  const table = useDataTable({
    data: data?.[resource] ?? [],
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
