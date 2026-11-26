import { useProducts } from "@medusajs/dashboard/hooks"
import { HttpTypes } from "@medusajs/framework/types"
import {
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  DataTableRowSelectionState,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { selectSingleProduct } from "../../lib/group-buy-form"
import { usePaginationTranslations } from "../common/use-pagination-translations"

type Product = Pick<HttpTypes.AdminProduct, "id" | "title" | "status">

const columnHelper = createDataTableColumnHelper<Product>()

// GB-6b2: dashboard ไม่ export product picker ให้ extension → DataTable ของ ui (อยู่ใน modal — spec 08)
// ADM-7 (spec 08 AC-10): ดึงสินค้าด้วย useProducts ของ dashboard (query key ของ Medusa) แทนการเรียก sdk เอง
// GB-6e (spec 04 กฎข้อ 30d, AC-50): single select — เลือกตัวใหม่แทนตัวเดิม; id อยู่ใน state ของฟอร์ม จึงคงอยู่ข้ามหน้า/การค้นหา
export const ProductPicker = ({
  value,
  onChange,
  error,
}: {
  value: string | null
  onChange: (id: string | null) => void
  error?: string | null
}) => {
  const { t } = useTranslation("ecom-group-buy")
  const paginationTranslations = usePaginationTranslations()
  // spec 10 กฎ 4e (AI18N-2): column ย้ายเข้า component เพื่อเรียก t; สถานะสินค้าแสดงด้วย key ของค่า (กฎ 7)
  const columns = useMemo(
    () => [
      // GB-6e: เลือกได้สินค้าเดียว — ไม่มีช่อง "เลือกทั้งหน้า"
      columnHelper.select({ header: () => null }),
      columnHelper.accessor("title", { header: t("picker.columns.product") }),
      columnHelper.accessor("status", {
        header: t("picker.columns.status"),
        cell: ({ getValue }) => t(`productStatus.${getValue()}`, { defaultValue: getValue() }),
      }),
    ],
    [t]
  )
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 5 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { products, count, isLoading } = useProducts(
    { q: search || undefined, limit, offset, fields: "id,title,status" },
    { placeholderData: keepPreviousData }
  )

  const rowSelection = useMemo(
    () => (value ? { [value]: true } : {}) as DataTableRowSelectionState,
    [value]
  )

  const table = useDataTable({
    data: (products ?? []) as Product[],
    columns,
    getRowId: (product) => product.id,
    rowCount: count ?? 0,
    isLoading,
    rowSelection: {
      state: rowSelection,
      onRowSelectionChange: (next) => onChange(selectSingleProduct(value, next)),
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
        {t("picker.product")}
      </Text>
      <Text size="xsmall" className="text-ui-fg-subtle" data-testid="gb-product-picker-count">
        {value ? t("picker.summarySelected") : t("picker.summaryNone")}
      </Text>
      {error && (
        <Text size="xsmall" className="text-ui-fg-error" data-testid="gb-product-required-error">
          {error}
        </Text>
      )}
      <div className="shadow-elevation-card-rest rounded-lg">
        <DataTable instance={table}>
          <DataTable.Toolbar>
            <DataTable.Search placeholder={t("picker.search")} />
          </DataTable.Toolbar>
          <DataTable.Table />
          <DataTable.Pagination translations={paginationTranslations} />
        </DataTable>
      </div>
    </div>
  )
}
