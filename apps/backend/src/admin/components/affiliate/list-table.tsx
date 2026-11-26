import { DataTable } from "@medusajs/dashboard/components"
import { useDebouncedSearch, useQueryParams } from "@medusajs/dashboard/hooks"
import { DataTableColumnDef, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
export const useAffiliateList = <T extends { id: string }>(
  resource: Resource,
  prefix: string,
  { searchable = false }: { searchable?: boolean } = {},
) => {
  const [count, setCount] = useState<number>()
  // ADM-40 (spec 08 กฎ 44): ช่องค้นหาของ DataTable เขียน `<prefix>_q` ลง URL ทุกตัวอักษร → request ใช้ค่าที่ debounce แล้ว
  // (useDebouncedSearch ของ dashboard เริ่มจากค่าว่าง จึงไม่ยิง request จนค่า debounce ตามทัน URL — reload ไม่ยิงรายการที่ไม่กรองก่อน)
  const { q: urlQuery } = useQueryParams(["q"], prefix)
  const typed = (searchable && urlQuery) || ""
  const { onSearchValueChange, query: q } = useDebouncedSearch()
  useEffect(() => onSearchValueChange(typed), [typed, onSearchValueChange])
  const settled = (q ?? "") === typed
  // คำค้นเปลี่ยน → กลับหน้าแรก (ผู้เขียน offset ลง URL ตัวเดียว — กฎ 13c)
  const offset = usePageOffset(prefix, PAGE_SIZE, { count, resetOn: typed })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...affiliateKeys.list(resource), PAGE_SIZE, offset, q],
    queryFn: () => listAffiliateResource<Resource, T>(resource, { limit: PAGE_SIZE, offset, ...(q ? { q } : {}) }),
    placeholderData: keepPreviousData,
    enabled: settled,
  })
  useEffect(() => setCount(data?.count), [data?.count])
  // spec 08 กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  return {
    rows: data?.[resource] ?? [],
    count: data?.count ?? 0,
    // รอ debounce ครั้งแรก (query ยังปิดอยู่) = กำลังโหลด ไม่ใช่ "ไม่พบผล"
    isLoading: isLoading || (!settled && !data),
    prefix,
    loadFailed,
    error,
    resource,
    searchable,
  }
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
  /** ADM-40 (กฎ 44): แสดงช่องค้นหาของ DataTable (`<prefix>_q`) — ใช้ได้เฉพาะ resource ที่ backend รับ `q` (affiliates — ADM-17) */
  searchable?: boolean
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
  searchable = false,
}: Props<T>) => {
  const { t } = useTranslation("ecom-affiliate")
  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง + ปุ่มใน action; testid เฉพาะตอนล้ม
  // ค้นหา (q) เปิดเฉพาะ resource ที่ backend รองรับ (ผู้เรียกส่ง searchable)
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
          // spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results"/"2 of 1 pages" จาก rowCount 0)
          enablePagination={!loadFailed}
          // ตอน error ไม่มีช่องค้นหา (แบบแถบแบ่งหน้า) — DataTable จึงแสดง empty (error) ไม่ใช่ filtered แม้ URL มีคำค้น
          enableSearch={searchable && !loadFailed}
          emptyState={{
            // spec 08 กฎ 29b: ชื่อใน heading error ตามชื่อแท็บ — แท็บ Ledger อ่าน resource `entries` (key `list.loadError.<resource>`)
            empty: loadFailed ? { heading: t(`list.loadError.${resource}`), description: error?.message } : { heading: empty },
            // ADM-40: ผลค้นหาว่าง = ข้อความ "ไม่พบผล" ของ dashboard (key general.noResultsTitle/noResultsMessage — spec 10 กฎ 6) ไม่ใช่ข้อความตารางว่าง
            filtered: {
              heading: t("general.noResultsTitle", { ns: "translation" }),
              description: t("general.noResultsMessage", { ns: "translation" }),
            },
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
      {/* spec 08 กฎ 41b (ADM-37): tooltip ของ TruncatedCell ใช้ textContent — ช่องว่างให้เป็น "ชื่อ อีเมล" (ลูกของ flex ไม่ render ช่องว่างนี้) */}
      {" "}
      <Text size="small" className="text-ui-fg-subtle">
        {row.affiliate.email}
      </Text>
    </div>
  ) : (
    <span data-testid="affiliate-row-affiliate">{row.affiliate_id}</span>
  )
