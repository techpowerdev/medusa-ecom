import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DataTable, LayoutComposer } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { Users } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, Text } from "@medusajs/ui"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Container } from "../../components/common/container"
import { usePageOffset } from "../../components/common/use-page-offset"
import { PageOffsetGate } from "../../components/common/page-offset-gate"
import { CreateCampaign } from "../../components/group-buy/create-campaign"
import { t } from "../../i18n/t"
import { isUnauthorized } from "../../lib/fetch-error"
import {
  Campaign,
  CAMPAIGN_STATUS_COLOR,
  groupBuyApi,
  groupBuyKeys,
} from "../../lib/group-buy"

const columnHelper = createDataTableColumnHelper<Campaign>()

// วันเวลาแสดงด้วย useDate ของ Medusa (timezone ของเครื่องแอดมิน — spec 08 กฎ 5)
// spec 10 กฎ 7 (AI18N-2): สถานะ/หน่วย/โหมดแสดงด้วย key ของค่า (ค่าที่ไม่รู้จักแสดงค่าดิบ) — ค่าที่ส่ง API ไม่เปลี่ยน
const useColumns = () => {
  const { t } = useTranslation("ecom-group-buy")
  const { getFullDate } = useDate()
  return useMemo(
    () => [
      columnHelper.accessor("name", { header: t("list.columns.campaign") }),
      columnHelper.accessor("status", {
        header: t("list.columns.status"),
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={CAMPAIGN_STATUS_COLOR[getValue()]}>
            {t(`status.${getValue()}`, { defaultValue: getValue() })}
          </Badge>
        ),
      }),
      columnHelper.accessor(
        (row) =>
          t(`targetValue.${row.target_type}`, {
            value: row.target_value,
            defaultValue: `${row.target_value} ${row.target_type}`,
          }),
        {
          id: "target",
          header: t("list.columns.target"),
        }
      ),
      columnHelper.accessor("group_mode", {
        header: t("list.columns.mode"),
        cell: ({ getValue }) => t(`groupMode.${getValue()}`, { defaultValue: getValue() }),
      }),
      columnHelper.accessor(
        (row) => (row.campaign?.ends_at ? getFullDate({ date: row.campaign.ends_at, includeTime: true }) : "-"),
        { id: "ends_at", header: t("list.columns.endsAt") }
      ),
      // แก้ส่วนลด/scope ที่หน้า promotion ของ Medusa (ADR-011)
      columnHelper.accessor("template_promotion_id", {
        header: t("list.columns.templatePromotion"),
        cell: ({ getValue, row }) =>
          getValue() ? (
            <Link to={`/promotions/${getValue()}`} onClick={(e) => e.stopPropagation()}>
              <Text size="small" className="text-ui-fg-interactive">
                {row.original.promotion?.code ?? t("list.openPromotion")}
              </Text>
            </Link>
          ) : (
            "-"
          ),
      }),
    ],
    [getFullDate, t]
  )
}

const PAGE_SIZE = 20
// spec 08 กฎ 9: หน้าปัจจุบันอยู่ใน URL (`gb_offset`) — DataTable ของ dashboard เขียน, usePageOffset อ่านกลับไปขอข้อมูล (กฎ 13)
const PREFIX = "gb"

// GB-6a: หน้า "Group buying" — รายการแคมเปญ + สร้างแคมเปญ (ADM-6: LayoutComposer + DataTable ของ dashboard; ADM-13: หัวตาราง + ปุ่มสร้างอยู่ที่ DataTable)
const GroupBuyingPage = () => {
  const { t } = useTranslation("ecom-group-buy")
  const columns = useColumns()
  const limit = PAGE_SIZE
  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...groupBuyKeys.campaigns, limit, offset],
    queryFn: () => groupBuyApi.listCampaigns({ limit, offset }),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])
  const [createOpen, setCreateOpen] = useState(false)

  // spec 08 กฎ 24b: 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 24a/d: ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  return (
    <LayoutComposer
      widgetsZonePrefix="group_buy.list"
      preferredLayoutId="core:single-column"
      sections={{
        main: (
          <LayoutComposer.Entry id="GroupBuyCampaignList">
            <Container>
              {/* spec 04 Q7: ต้นแบบ GBT-* มองเห็นในหน้า Promotions — เตือนห้ามเปิดใช้/เผยแพร่ */}
              <div className="px-6 py-3">
                <Text size="small" leading="compact" className="text-ui-fg-error" data-testid="gb-template-warning">
                  {t("list.templateWarning")}
                </Text>
              </div>
              <div data-testid="gb-campaigns-table">
                {/* กฎ 24a: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัวตาราง + ปุ่ม Create campaign */}
                <div data-testid={loadFailed ? "gb-campaigns-error" : undefined}>
                  {/* backend ไม่รองรับค้นหา (q) → ปิด search */}
                  <PageOffsetGate prefix={PREFIX}>
                    <DataTable
                      heading={t("list.heading")}
                      subHeading={t("list.subHeading")}
                      action={{ label: t("list.create"), onClick: () => setCreateOpen(true) }}
                      data={data?.campaigns ?? []}
                      columns={columns}
                      getRowId={(campaign) => campaign.id}
                      rowCount={data?.count ?? 0}
                      isLoading={isLoading}
                      prefix={PREFIX}
                      pageSize={PAGE_SIZE}
                      // spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results"/"2 of 1 pages" จาก rowCount 0)
                      enablePagination={!loadFailed}
                      enableSearch={false}
                      rowHref={(campaign) => `/group-buying/${campaign.id}`}
                      emptyState={{
                        empty: loadFailed
                          ? { heading: t("list.loadError"), description: error?.message }
                          : {
                              heading: t("list.emptyHeading"),
                              description: t("list.emptyDescription"),
                            },
                      }}
                    />
                  </PageOffsetGate>
                </div>
              </div>
              <CreateCampaign open={createOpen} onOpenChange={setCreateOpen} />
            </Container>
          </LayoutComposer.Entry>
        ),
      }}
    />
  )
}

// spec 10 กฎ 9 (AI18N-2): label เป็น key + translationNs (string literal ทั้งคู่ — admin-vite-plugin อ่านเฉพาะ literal)
export const config = defineRouteConfig({
  label: "nav.groupBuying",
  translationNs: "ecom-group-buy",
  icon: Users,
})

// ADM-6: createRouteMap ของ dashboard สร้าง route "group-buying" เป็นพ่อของ ":id" → breadcrumb "Group buying › <ชื่อแคมเปญ>"
// spec 10 กฎ 4b: breadcrumb นอก component ใช้ helper t (เรียกตอน render ของ Shell)
export const handle = { breadcrumb: () => t("ecom-group-buy", "nav.groupBuying") }

export default GroupBuyingPage
