import { DataTable } from "@medusajs/dashboard/components"
import { useQueryParams } from "@medusajs/dashboard/hooks"
import { Badge, createDataTableColumnHelper } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { evoucherApi, evoucherKeys, Pool } from "../../lib/evoucher"
import { poolsListQuery } from "../../lib/evoucher-query"

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

const PAGE_SIZE = 20
const PREFIX = "pools"

// spec 08 กฎ 9: หน้าปัจจุบันอยู่ใน URL (`pools_offset`) — DataTable ของ dashboard เขียน, useQueryParams อ่านกลับเพื่อ request
export const PoolsTable = () => {
  const params = useQueryParams(["offset"], PREFIX)
  const query = poolsListQuery(params, PAGE_SIZE)

  const { data, isLoading } = useQuery({
    queryKey: [...evoucherKeys.pools, query],
    queryFn: () => evoucherApi.listPools(query),
    placeholderData: keepPreviousData,
  })

  return (
    <DataTable
      data={data?.pools ?? []}
      columns={columns}
      getRowId={(pool) => pool.id}
      rowCount={data?.count ?? 0}
      isLoading={isLoading}
      heading="E-voucher pools"
      subHeading="Create a pool from a product variant page (Voucher pool widget), then import partner codes here."
      prefix={PREFIX}
      pageSize={PAGE_SIZE}
      enableSearch={false}
      rowHref={(pool) => `/evouchers/pools/${pool.id}`}
      emptyState={{
        empty: {
          heading: "No voucher pools yet",
          description: "Open a product variant and create a voucher pool from the Voucher pool widget.",
        },
      }}
    />
  )
}
