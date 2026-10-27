import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Container, createDataTableColumnHelper, Heading, Tabs } from "@medusajs/ui"
import { AffiliatesTable } from "../../components/affiliate/affiliates-table"
import { AffiliateListTable } from "../../components/affiliate/list-table"
import { PayoutsTable } from "../../components/affiliate/payouts-table"
import { CommissionEntry, Program } from "../../lib/affiliate"
import { formatAmount, formatDate } from "../../lib/affiliate-format"

// AF-6 (spec 05 "Admin UI"): หน้า Affiliate → Programs, Affiliates, Ledger, Payouts (อ่านจาก admin API ของ AF-5)
const program = createDataTableColumnHelper<Program>()
const programColumns = [
  program.accessor("name", { header: "Program" }),
  program.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
  }),
  program.accessor("starts_at", {
    header: "Starts",
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  program.accessor("ends_at", {
    header: "Ends",
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  program.accessor((row) => `${row.commission_value}%`, {
    id: "rate",
    header: "Commission",
  }),
  program.accessor("hold_days", { header: "Hold days" }),
]

// AF-12b: แท็บ Affiliates (approve/suspend/reactivate + payout info) อยู่ที่ components/affiliate/affiliates-table.tsx
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
  {
    value: "programs",
    label: "Programs",
    content: <AffiliateListTable resource="programs" columns={programColumns} empty="No programs yet" />,
  },
  {
    value: "affiliates",
    label: "Affiliates",
    content: <AffiliatesTable />,
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
