import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useDate } from "@medusajs/dashboard/hooks"
import { castNumber, getLocaleAmount } from "@medusajs/dashboard/lib"
import { ReceiptPercent } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, Tabs } from "@medusajs/ui"
import { useMemo } from "react"
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
const entry = createDataTableColumnHelper<CommissionEntry>()

const LedgerTable = () => {
  const { getFullDate } = useDate()
  const list = useAffiliateList<CommissionEntry>("entries", "ledger")
  const rows = useAffiliateNames(list.rows)

  const columns = useMemo(
    () => [
      entry.accessor("created_at", {
        header: "Created",
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
      entry.accessor("affiliate_id", {
        header: "Affiliate",
        cell: ({ row }) => <AffiliateCell row={row.original} />,
      }),
      entry.accessor("order_id", { header: "Order" }),
      // API ส่งหน่วยหลัก (major units) — แสดงตามนั้น ไม่หาร 100 และไม่ใช้คำนวณ
      entry.accessor((row) => getLocaleAmount(castNumber(row.amount), row.currency), {
        id: "amount",
        header: "Amount",
      }),
      entry.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
      }),
    ],
    [getFullDate],
  )

  return (
    <AffiliateListTable
      {...list}
      rows={rows}
      columns={columns}
      heading="Ledger"
      subHeading="Commission entries, newest first."
      empty="No commission entries yet"
    />
  )
}

const TABS = [
  { value: "programs", label: "Programs", content: <ProgramsTable /> },
  { value: "affiliates", label: "Affiliates", content: <AffiliatesTable /> },
  { value: "ledger", label: "Ledger", content: <LedgerTable /> },
  { value: "payouts", label: "Payouts", content: <PayoutsTable /> },
]

const AffiliatePage = () => (
  <Container>
    <Header title="Affiliate" />
    <Tabs defaultValue="programs">
      <Tabs.List className="px-6 py-4">
        {TABS.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} data-testid={`affiliate-admin-tab-${tab.value}`}>
            {tab.label}
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

export const config = defineRouteConfig({
  label: "Affiliate",
  icon: ReceiptPercent,
})

export default AffiliatePage
