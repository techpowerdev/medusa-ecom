import {
  Badge,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { evoucherApi, evoucherKeys, Pool } from "../../lib/evoucher"

const columnHelper = createDataTableColumnHelper<Pool>()

const count = (status: keyof Pool["code_counts"], header: string) =>
  columnHelper.accessor((row) => row.code_counts[status], { id: status, header })

const columns = [
  columnHelper.accessor("name", { header: "Pool" }),
  columnHelper.accessor((row) => row.partner.name, { id: "partner", header: "Partner" }),
  count("available", "Available"),
  count("allocated", "Allocated"),
  count("delivered", "Delivered"),
  count("void", "Void"),
  columnHelper.accessor("low_stock", {
    header: "Stock",
    cell: ({ getValue, row }) =>
      getValue() ? (
        <Badge size="2xsmall" color="red">
          Low stock (&lt; {row.original.low_stock_threshold})
        </Badge>
      ) : (
        <Badge size="2xsmall" color="green">
          OK
        </Badge>
      ),
  }),
]

export const PoolsTable = () => {
  const navigate = useNavigate()
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [...evoucherKeys.pools, limit, offset],
    queryFn: () => evoucherApi.listPools({ limit, offset }),
    placeholderData: keepPreviousData,
  })

  const table = useDataTable({
    data: data?.pools ?? [],
    columns,
    getRowId: (pool) => pool.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_, pool) => navigate(`/evouchers/pools/${pool.id}`),
  })

  return (
    <DataTable instance={table}>
      <DataTable.Table
        emptyState={{
          empty: {
            heading: "No voucher pools yet",
            description: "Open a product variant and create a voucher pool from the Voucher pool widget.",
          },
        }}
      />
      <DataTable.Pagination />
    </DataTable>
  )
}
