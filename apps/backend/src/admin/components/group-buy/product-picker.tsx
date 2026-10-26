import { HttpTypes } from "@medusajs/framework/types"
import {
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { sdk } from "../../lib/client"

type Product = Pick<HttpTypes.AdminProduct, "id" | "title" | "status">

const columnHelper = createDataTableColumnHelper<Product>()
const columns = [
  columnHelper.select(),
  columnHelper.accessor("title", { header: "Product" }),
  columnHelper.accessor("status", { header: "Status" }),
]

// GB-6b2 (spec 04 AC-33): dashboard ไม่ export product picker ให้ extension → DataTable + sdk.admin.product.list
// selection เก็บเป็น id ใน state ของฟอร์ม จึงคงอยู่ข้ามหน้า/การค้นหา
export const ProductPicker = ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => {
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 5 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: ["gb-product-picker", search, limit, offset],
    queryFn: () => sdk.admin.product.list({ q: search || undefined, limit, offset, fields: "id,title,status" }),
    placeholderData: keepPreviousData,
  })

  const rowSelection = useMemo(
    () => Object.fromEntries(value.map((id) => [id, true])) as DataTableRowSelectionState,
    [value]
  )

  const table = useDataTable({
    data: (data?.products ?? []) as Product[],
    columns,
    getRowId: (product) => product.id,
    rowCount: data?.count ?? 0,
    isLoading,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: (next) => onChange(Object.keys(next).filter((id) => next[id])),
    },
    search: {
      state: search,
      onSearchChange: (q) => {
        setSearch(q)
        setPagination((p) => ({ ...p, pageIndex: 0 }))
      },
    },
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <div data-testid="gb-product-picker" className="flex flex-col gap-y-2">
      <Text size="small" weight="plus">
        Products
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle" data-testid="gb-product-picker-count">
        {value.length ? `${value.length} selected` : "None selected = all products"}. Scope can be refined later on
        the template promotion.
      </Text>
      <div className="shadow-elevation-card-rest rounded-lg">
        <DataTable instance={table}>
          <DataTable.Toolbar>
            <DataTable.Search placeholder="Search products by name" />
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination />
        </DataTable>
      </div>
    </div>
  )
}
