import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DataTable, LayoutComposer } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { Users } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Container } from "../../components/common/container"
import { Header } from "../../components/common/header"
import { usePageOffset } from "../../components/common/use-page-offset"
import { CreateCampaign } from "../../components/group-buy/create-campaign"
import {
  Campaign,
  CAMPAIGN_STATUS_COLOR,
  groupBuyApi,
  groupBuyKeys,
} from "../../lib/group-buy"

const columnHelper = createDataTableColumnHelper<Campaign>()

// วันเวลาแสดงด้วย useDate ของ Medusa (timezone ของเครื่องแอดมิน — spec 08 กฎ 5)
const useColumns = () => {
  const { getFullDate } = useDate()
  return useMemo(
    () => [
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
      columnHelper.accessor(
        (row) => (row.campaign?.ends_at ? getFullDate({ date: row.campaign.ends_at, includeTime: true }) : "-"),
        { id: "ends_at", header: "Ends (ICT)" }
      ),
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
    ],
    [getFullDate]
  )
}

const PAGE_SIZE = 20
// spec 08 กฎ 9: หน้าปัจจุบันอยู่ใน URL (`gb_offset`) — DataTable ของ dashboard เขียน, usePageOffset อ่านกลับไปขอข้อมูล (กฎ 13)
const PREFIX = "gb"

// GB-6a: หน้า "Group buying" — รายการแคมเปญ + สร้างแคมเปญ (ADM-6: LayoutComposer + Header + DataTable ของ dashboard)
const GroupBuyingPage = () => {
  const columns = useColumns()
  const limit = PAGE_SIZE
  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })

  const { data, isLoading } = useQuery({
    queryKey: [...groupBuyKeys.campaigns, limit, offset],
    queryFn: () => groupBuyApi.listCampaigns({ limit, offset }),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])

  return (
    <LayoutComposer
      widgetsZonePrefix="group_buy.list"
      preferredLayoutId="core:single-column"
      sections={{
        main: (
          <LayoutComposer.Entry id="GroupBuyCampaignList">
            <Container>
              <Header
                title="Group-buy campaigns"
                subtitle="Discount and product scope live on each campaign's template promotion (GBT-…); edits apply only to groups created afterwards."
                actions={[{ type: "custom", children: <CreateCampaign /> }]}
              />
              {/* spec 04 Q7: ต้นแบบ GBT-* มองเห็นในหน้า Promotions — เตือนห้ามเปิดใช้/เผยแพร่ */}
              <div className="px-6 py-3">
                <Text size="small" leading="compact" className="text-ui-fg-error">
                  Never activate or share GBT- template codes; customers get a GB- code per group.
                </Text>
              </div>
              <div data-testid="gb-campaigns-table">
                {/* backend ไม่รองรับค้นหา (q) → ปิด search */}
                <DataTable
                  data={data?.campaigns ?? []}
                  columns={columns}
                  getRowId={(campaign) => campaign.id}
                  rowCount={data?.count ?? 0}
                  isLoading={isLoading}
                  prefix={PREFIX}
                  pageSize={PAGE_SIZE}
                  enableSearch={false}
                  rowHref={(campaign) => `/group-buying/${campaign.id}`}
                  emptyState={{
                    empty: {
                      heading: "No group-buy campaigns yet",
                      description: "Create a campaign to start selling in groups.",
                    },
                  }}
                />
              </div>
            </Container>
          </LayoutComposer.Entry>
        ),
      }}
    />
  )
}

export const config = defineRouteConfig({
  label: "Group buying",
  icon: Users,
})

// ADM-6: createRouteMap ของ dashboard สร้าง route "group-buying" เป็นพ่อของ ":id" → breadcrumb "Group buying › <ชื่อแคมเปญ>"
export const handle = { breadcrumb: () => "Group buying" }

export default GroupBuyingPage
