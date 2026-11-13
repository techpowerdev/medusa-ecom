import { DataTable } from "@medusajs/dashboard/components"
import { Badge, createDataTableColumnHelper } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { evoucherApi, evoucherKeys, Pool } from "../../lib/evoucher"
import { isUnauthorized } from "../../lib/fetch-error"
import { usePageOffset } from "../common/use-page-offset"
import { PageOffsetGate } from "../common/page-offset-gate"

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

// spec 08 กฎ 9: หน้าปัจจุบันอยู่ใน URL (`pools_offset`) — DataTable ของ dashboard เขียน, usePageOffset อ่านกลับเพื่อ request (กฎ 13)
export const PoolsTable = () => {
  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })
  const query = { limit: PAGE_SIZE, offset }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...evoucherKeys.pools, query],
    queryFn: () => evoucherApi.listPools(query),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])

  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  // กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง; testid เฉพาะตอนล้ม
  return (
    <div data-testid={loadFailed ? "evoucher-pools-error" : undefined}>
      <PageOffsetGate prefix={PREFIX}>
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
            empty: loadFailed
              ? { heading: "Could not load voucher pools", description: error?.message }
              : {
                  heading: "No voucher pools yet",
                  description: "Open a product variant and create a voucher pool from the Voucher pool widget.",
                },
          }}
        />
      </PageOffsetGate>
    </div>
  )
}
