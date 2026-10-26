import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  Text,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CreateCampaign } from "../../components/group-buy/create-campaign"
import {
  Campaign,
  CAMPAIGN_STATUS_COLOR,
  formatDateTime,
  groupBuyApi,
  groupBuyKeys,
} from "../../lib/group-buy"

const columnHelper = createDataTableColumnHelper<Campaign>()

const columns = [
  columnHelper.accessor("name", { header: "Campaign" }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => (
      <Badge size="2xsmall" color={CAMPAIGN_STATUS_COLOR[getValue()]}>
        {getValue()}
      </Badge>
    ),
  }),
  columnHelper.accessor((row) => `${row.target_value} ${row.target_type}`, {
    id: "target",
    header: "Target",
  }),
  columnHelper.accessor("group_mode", { header: "Mode" }),
  columnHelper.accessor((row) => formatDateTime(row.campaign?.ends_at), {
    id: "ends_at",
    header: "Ends (ICT)",
  }),
  // แก้ส่วนลด/scope ที่หน้า promotion ของ Medusa (ADR-011)
  columnHelper.accessor("template_promotion_id", {
    header: "Template promotion",
    cell: ({ getValue, row }) =>
      getValue() ? (
        <Link to={`/promotions/${getValue()}`} onClick={(e) => e.stopPropagation()}>
          <Text size="small" className="text-ui-fg-interactive">
            {row.original.promotion?.code ?? "Open"}
          </Text>
        </Link>
      ) : (
        "-"
      ),
  }),
]

// GB-6a: หน้า "Group buying" — รายการแคมเปญ + สร้างแคมเปญ
const GroupBuyingPage = () => {
  const navigate = useNavigate()
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [...groupBuyKeys.campaigns, limit, offset],
    queryFn: () => groupBuyApi.listCampaigns({ limit, offset }),
    placeholderData: keepPreviousData,
  })

  const table = useDataTable({
    data: data?.campaigns ?? [],
    columns,
    getRowId: (campaign) => campaign.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_, campaign) => navigate(`/group-buying/${campaign.id}`),
  })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h1">Group-buy campaigns</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Discount and product scope live on each campaign's template promotion (GBT-…); edits apply
            only to groups created afterwards.
          </Text>
          {/* spec 04 Q7: ต้นแบบ GBT-* มองเห็นในหน้า Promotions — เตือนห้ามเปิดใช้/เผยแพร่ */}
          <Text size="small" leading="compact" className="text-ui-fg-error">
            Never activate or share GBT- template codes; customers get a GB- code per group.
          </Text>
        </div>
        <CreateCampaign />
      </div>
      <DataTable instance={table}>
        <DataTable.Table
          emptyState={{
            empty: {
              heading: "No group-buy campaigns yet",
              description: "Create a campaign to start selling in groups.",
            },
          }}
        />
        <DataTable.Pagination />
      </DataTable>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Group buying",
})

export default GroupBuyingPage
