import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useDate } from "@medusajs/dashboard/hooks"
import { castNumber, getLocaleAmount } from "@medusajs/dashboard/lib"
import { ReceiptPercent } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, Tabs } from "@medusajs/ui"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { AffiliatesTable } from "../../components/affiliate/affiliates-table"
import {
  AffiliateCell,
  AffiliateListTable,
  useAffiliateList,
  useAffiliateNames,
} from "../../components/affiliate/list-table"
import { PayoutsTable } from "../../components/affiliate/payouts-table"
import { ProgramsTable } from "../../components/affiliate/programs-table"
import { Container } from "../../components/common/container"
import { Header } from "../../components/common/header"
import { CommissionEntry } from "../../lib/affiliate"

// AF-6 (spec 05 "Admin UI"): หน้า Affiliate → Programs, Affiliates, Ledger, Payouts (อ่านจาก admin API ของ AF-5)
// AF-12a: แท็บ Programs (สร้าง/แก้/ลบ) อยู่ที่ components/affiliate/programs-table.tsx
// AF-14: คอลัมน์ Affiliate ของ Ledger/Payouts แสดงชื่อ + อีเมล (กฎ 38)
// AF-12b: แท็บ Affiliates (approve/suspend/reactivate + payout info) อยู่ที่ components/affiliate/affiliates-table.tsx
// ADM-8a (spec 08): Header + DataTable ของ dashboard (prefix ต่อแท็บ), เงินด้วย getLocaleAmount, วันเวลาด้วย useDate
// spec 10 (AI18N-4): ข้อความผ่าน namespace `ecom-affiliate`; สถานะ = `<prefix>.status.<ค่า>` (ค่าที่ไม่รู้จักแสดงค่าดิบ — กฎ 7)
const entry = createDataTableColumnHelper<CommissionEntry>()

const LedgerTable = () => {
  const { t } = useTranslation("ecom-affiliate")
  const { getFullDate } = useDate()
  const list = useAffiliateList<CommissionEntry>("entries", "ledger")
  const rows = useAffiliateNames(list.rows)

  const columns = useMemo(
    () => [
      entry.accessor("created_at", {
        header: t("ledger.columns.created_at"),
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
      // spec 08 กฎ 42a (ADM-38): เนื้อหา 250px แบบกฎ 41a (ไม่ใช่คอลัมน์แรก: 250 + pr-6 = 274) — ชื่อ/อีเมลยาวถูกตัดที่ขอบ cell
      // และมี tooltip "ชื่อ อีเมล" ของ TruncatedCell จาก AffiliateCell เดิม (กฎ 41b/42b)
      entry.accessor("affiliate_id", {
        header: t("ledger.columns.affiliate_id"),
        size: 274,
        maxSize: 274,
        cell: ({ row }) => <AffiliateCell row={row.original} />,
      }),
      entry.accessor("order_id", { header: t("ledger.columns.order_id") }),
      // API ส่งหน่วยหลัก (major units) — แสดงตามนั้น ไม่หาร 100 และไม่ใช้คำนวณ
      entry.accessor((row) => getLocaleAmount(castNumber(row.amount), row.currency), {
        id: "amount",
        header: t("ledger.columns.amount"),
      }),
      // spec 08 กฎ 42c (ADM-38): คอลัมน์สุดท้ายเป็นคอลัมน์ auto (ไม่มี width) รับความกว้างส่วนเกินของตาราง w-full
      // — ไม่งั้น Chrome แจกส่วนเกินตามสัดส่วนให้คอลัมน์ Affiliate จนเกิน 250px (แบบกฎ 41c, Q12 = ก)
      entry.accessor("status", {
        header: t("ledger.columns.status"),
        size: undefined,
        cell: ({ getValue }) => <Badge size="2xsmall">{t(`ledger.status.${getValue()}`, { defaultValue: getValue() })}</Badge>,
      }),
    ],
    [getFullDate, t],
  )

  return (
    // spec 08 กฎ 42d (ADM-38): wrapper testid แบบอีก 3 ตาราง ให้ e2e หาแถวภายในตาราง Ledger
    <div data-testid="affiliate-ledger-table">
      <AffiliateListTable
        {...list}
        rows={rows}
        columns={columns}
        heading={t("ledger.heading")}
        subHeading={t("ledger.subHeading")}
        empty={t("ledger.empty")}
      />
    </div>
  )
}

// ชื่อแท็บ = key `tabs.<value>` (แปลตอน render — spec 10 กฎ 4e)
const TABS = [
  { value: "programs", content: <ProgramsTable /> },
  { value: "affiliates", content: <AffiliatesTable /> },
  { value: "ledger", content: <LedgerTable /> },
  { value: "payouts", content: <PayoutsTable /> },
]

// ADM-43 (spec 08 กฎ 47c): แท็บที่เลือกอยู่ใน URL (`?tab=<key>`) — reload/แชร์ลิงก์กลับแท็บเดิม; ไม่มี/ค่าผิด → Programs
// เขียนแบบ functional update ให้ `<prefix>_offset`/`affiliates_q` ของตารางคงอยู่
// activationMode="manual" (qa #491 D-1): แบบ automatic Radix เรียก onValueChange ทั้งตอน mousedown และ focus ก่อน router commit
// คลิกเดียวจึง push history 2 รายการ (back ต้องกด 2 ครั้ง) — manual เลือกแท็บด้วยคลิก/Enter/Space ครั้งเดียว ลูกศรแค่ย้ายโฟกัส
const AffiliatePage = () => {
  const { t } = useTranslation("ecom-affiliate")
  const [searchParams, setSearchParams] = useSearchParams()
  const active = TABS.find((t) => t.value === searchParams.get("tab"))?.value ?? TABS[0].value
  const selectTab = (value: string) =>
    setSearchParams((params) => {
      params.set("tab", value)
      return params
    })

  return (
    <Container>
      <Header title={t("page.title")} />
      <Tabs value={active} onValueChange={selectTab} activationMode="manual">
        <Tabs.List className="px-6 py-4">
          {TABS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} data-testid={`affiliate-admin-tab-${tab.value}`}>
              {t(`tabs.${tab.value}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {TABS.map((tab) => (
          <Tabs.Content key={tab.value} value={tab.value}>
            {tab.content}
          </Tabs.Content>
        ))}
      </Tabs>
    </Container>
  )
}

// spec 10 กฎ 9: label เป็น key + translationNs (string literal ทั้งคู่)
export const config = defineRouteConfig({
  label: "nav.label",
  translationNs: "ecom-affiliate",
  icon: ReceiptPercent,
})

export default AffiliatePage
