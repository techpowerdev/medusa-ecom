import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Container, createDataTableColumnHelper, Heading, Tabs } from "@medusajs/ui"
import { AffiliateListTable } from "../../components/affiliate/list-table"
import { PayoutsTable } from "../../components/affiliate/payouts-table"
import { ProgramsTable } from "../../components/affiliate/programs-table"
import { Affiliate, CommissionEntry } from "../../lib/affiliate"
import { formatAmount, formatDate } from "../../lib/affiliate-format"

// AF-6 (spec 05 "Admin UI"): หน้า Affiliate → Programs, Affiliates, Ledger, Payouts (อ่านจาก admin API ของ AF-5)
// AF-12a: แท็บ Programs (สร้าง/แก้/ลบ) อยู่ที่ components/affiliate/programs-table.tsx
const affiliate = createDataTableColumnHelper<Affiliate>()
const affiliateColumns = [
  affiliate.accessor("name", { header: "Name" }),
  affiliate.accessor("email", { header: "Email" }),
  affiliate.accessor("code", { header: "Code" }),
  affiliate.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
  }),
  affiliate.accessor("created_at", {
    header: "Joined",
    cell: ({ getValue }) => formatDate(getValue()),
  }),
]

const entry = createDataTableColumnHelper<CommissionEntry>()
const entryColumns = [
  entry.accessor("created_at", {
    header: "Created",
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  entry.accessor("affiliate_id", { header: "Affiliate" }),
  entry.accessor("order_id", { header: "Order" }),
  entry.accessor((row) => formatAmount(row.amount, row.currency), {
    id: "amount",
    header: "Amount",
  }),
  entry.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
  }),
]

const TABS = [
  { value: "programs", label: "Programs", content: <ProgramsTable /> },
  {
    value: "affiliates",
    label: "Affiliates",
    content: (
      <AffiliateListTable resource="affiliates" columns={affiliateColumns} empty="No affiliates yet" />
    ),
  },
  {
    value: "ledger",
    label: "Ledger",
    content: (
      <AffiliateListTable resource="entries" columns={entryColumns} empty="No commission entries yet" />
    ),
  },
  { value: "payouts", label: "Payouts", content: <PayoutsTable /> },
]

const AffiliatePage = () => (
  <Container className="divide-y p-0">
    <div className="px-6 py-4">
      <Heading level="h1">Affiliate</Heading>
    </div>
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
})

export default AffiliatePage
