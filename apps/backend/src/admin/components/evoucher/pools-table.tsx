import { DataTable } from "@medusajs/dashboard/components"
import { EllipsisHorizontal } from "@medusajs/icons"
import { createDataTableColumnHelper, IconButton } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { evoucherApi, evoucherKeys, Pool } from "../../lib/evoucher"
import { isUnauthorized } from "../../lib/fetch-error"
import { createSingleFlight } from "../../lib/single-flight"
import { PoolDeleteMenu, PoolStockBadge } from "./pool-delete"
import { usePageOffset } from "../common/use-page-offset"
import { PageOffsetGate } from "../common/page-offset-gate"

const columnHelper = createDataTableColumnHelper<Pool>()

// spec 10 (AI18N-3): ชื่อ countColumn — ใช้ใน component ซึ่งมี state ชื่อ `count` (เดิมเรียกที่ระดับ module)
const countColumn = (status: keyof Pool["code_counts"], header: string) =>
  columnHelper.accessor((row) => row.code_counts[status], { id: status, header })

const PAGE_SIZE = 20
const PREFIX = "pools"

// spec 08 กฎ 9: หน้าปัจจุบันอยู่ใน URL (`pools_offset`) — DataTable ของ dashboard เขียน, usePageOffset อ่านกลับเพื่อ request (กฎ 13)
export const PoolsTable = () => {
  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })
  const query = { limit: PAGE_SIZE, offset }
  // EV-21 (กฎข้อ 37): guard ตัวเดียวทั้งตาราง (แบบ PartnersSection) — ไม่ hold หลังลบ เพราะลบ pool อื่นต่อได้
  const [deleteOnce] = useState(createSingleFlight)
  const { t } = useTranslation("ecom-evoucher")
  // `cell` ต้องคงที่ข้าม render (เมนูที่เปิดอยู่ไม่ปิดเองตอน refetch — spec 08 กฎ 20a)
  // spec 10 กฎ 4e: header แปลจึงย้ายจากค่าคงที่ระดับ module เข้ามาที่นี่ (สร้างใหม่เฉพาะตอนเปลี่ยนภาษา)
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", { header: t("fields.pool") }),
      columnHelper.accessor((row) => row.partner.name, { id: "partner", header: t("fields.partner") }),
      countColumn("available", t("pools.columns.available")),
      countColumn("allocated", t("pools.columns.allocated")),
      countColumn("delivered", t("pools.columns.delivered")),
      countColumn("void", t("pools.columns.void")),
      // EV-21 (spec 02 กฎข้อ 37): pool ไม่มี code = "No codes" แทน "Low stock"
      columnHelper.accessor("low_stock", {
        header: t("pools.columns.stock"),
        cell: ({ row }) => <PoolStockBadge pool={row.original} showOk />,
      }),
      columnHelper.display({
        id: "actions",
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
        cell: ({ row }) => (
          <PoolDeleteMenu pool={row.original} deleteOnce={deleteOnce}>
            <IconButton size="small" variant="transparent" data-testid="evoucher-pool-row-actions">
              <EllipsisHorizontal />
            </IconButton>
          </PoolDeleteMenu>
        ),
      }),
    ],
    [deleteOnce, t]
  )

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

  return (
    // กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง; testid เฉพาะตอนล้ม
    <div data-testid={loadFailed ? "evoucher-pools-error" : undefined}>
      {/* D1 (qa #454 — session หลักตัดสิน): prompt ปิดตั้งแต่คลิกแรกของ dblclick แล้วคลิกที่สองตกลงบนแถวใต้ปุ่มยืนยัน → rowHref พาไปหน้า pool
          (อาจเป็น pool ที่เพิ่งลบ) — ไม่ให้คลิกถึงแถวระหว่างลบ (single-flight ยังทำงาน) หรือเป็นคลิกต่อเนื่อง (event.detail > 1 แบบ ADM-39);
          คลิกเดียวที่แถวยังเปิดหน้า pool ตามเดิม (คลิกต่อเนื่องที่แถวเปิดหน้าตั้งแต่คลิกแรกอยู่แล้ว) */}
      <div
        onClickCapture={(e) => {
          if (e.detail > 1 || deleteOnce.isPending()) {
            e.stopPropagation()
          }
        }}
      >
        <PageOffsetGate prefix={PREFIX}>
          <DataTable
            data={data?.pools ?? []}
            columns={columns}
            getRowId={(pool) => pool.id}
            rowCount={data?.count ?? 0}
            isLoading={isLoading}
            heading={t("pools.heading")}
            subHeading={t("pools.subHeading")}
            prefix={PREFIX}
            pageSize={PAGE_SIZE}
            // spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results"/"2 of 1 pages" จาก rowCount 0)
            enablePagination={!loadFailed}
            enableSearch={false}
            rowHref={(pool) => `/evouchers/pools/${pool.id}`}
            emptyState={{
              empty: loadFailed
                ? { heading: t("pools.loadError"), description: error?.message }
                : {
                    heading: t("pools.emptyHeading"),
                    description: t("pools.emptyDescription"),
                  },
            }}
          />
        </PageOffsetGate>
      </div>
    </div>
  )
}
