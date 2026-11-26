import { LayoutComposer, SectionRow } from "@medusajs/dashboard/components"
import { EllipsisHorizontal } from "@medusajs/icons"
import { Badge, IconButton, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { LoaderFunctionArgs, UIMatch, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { Container } from "../../../../components/common/container"
import { Header } from "../../../../components/common/header"
import { CodesTable } from "../../../../components/evoucher/codes-table"
import { ImportCodes } from "../../../../components/evoucher/import-codes"
import { PoolDeleteMenu, PoolStockBadge } from "../../../../components/evoucher/pool-delete"
// helper t ของ breadcrumb (นอก component) — ใน PoolPage ถูกบังด้วย t ของ useTranslation (ชื่อ t ให้ unit ตรวจ key ได้ — spec 10 กฎ 6)
import { t as tNs } from "../../../../i18n/t"
import { CODE_STATUSES, evoucherApi, evoucherKeys, STATUS_COLOR } from "../../../../lib/evoucher"
import { createSingleFlight } from "../../../../lib/single-flight"

// EV-6: รายละเอียด pool — จำนวน code ต่อสถานะ, import CSV, รายการ code (masked) + reveal (audit)
// ADM-4: LayoutComposer (core:single-column) + Header + SectionRow ของ dashboard
const PoolPage = () => {
  const { t } = useTranslation("ecom-evoucher")
  const { id } = useParams()
  const poolId = id!

  // ADM-11 (spec 08 กฎ 14): ใช้ผลของ loader เป็นค่าเริ่ม → ไม่ GET pool ซ้ำตอนเปิดหน้า (staleTime ของ QueryClient ของ dashboard)
  const initialData = (useLoaderData() as PoolLoaderData | undefined) ?? undefined
  const { data, isLoading } = useQuery({
    queryKey: evoucherKeys.pool(poolId),
    queryFn: () => evoucherApi.retrievePool(poolId),
    initialData,
  })
  const pool = data?.pool
  // EV-21 (spec 02 กฎข้อ 37): ลบสำเร็จ → lock ค้าง (hold) ระหว่างกลับรายการ — pool นี้ไม่มีแล้ว ไม่ต้อง release
  const navigate = useNavigate()
  const [deleteOnce] = useState(createSingleFlight)
  const onDeleted = () => {
    deleteOnce.hold()
    navigate("/evouchers")
  }

  return (
    <LayoutComposer
      widgetsZonePrefix="evoucher_pool.details"
      preferredLayoutId="core:single-column"
      sections={{
        main: (
          <>
            <LayoutComposer.Entry id="EvoucherPoolGeneralSection">
              <Container>
                <Header
                  title={isLoading ? t("general.loading") : (pool?.name ?? "")}
                  actions={[
                    ...(pool ? [{ type: "custom" as const, children: <PoolStockBadge pool={pool} /> }] : []),
                    {
                      type: "button",
                      props: { variant: "secondary", children: t("pool.allPools") },
                      link: { to: "/evouchers" },
                    },
                    ...(pool
                      ? [
                          {
                            type: "custom" as const,
                            children: (
                              <PoolDeleteMenu pool={pool} deleteOnce={deleteOnce} onDeleted={onDeleted}>
                                <IconButton size="small" variant="transparent" data-testid="evoucher-pool-actions">
                                  <EllipsisHorizontal />
                                </IconButton>
                              </PoolDeleteMenu>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
                {pool && (
                  <div className="grid grid-cols-4 gap-x-4 px-6 py-4">
                    {CODE_STATUSES.map((status) => (
                      <div key={status} className="flex flex-col gap-y-1">
                        <Badge size="2xsmall" color={STATUS_COLOR[status]} className="w-fit">
                          {t(`codeStatus.${status}`, { defaultValue: status })}
                        </Badge>
                        <Text size="xlarge" weight="plus">
                          {pool.code_counts[status]}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}
                {pool && (
                  <>
                    <SectionRow title={t("fields.partner")} value={pool.partner.name} />
                    <SectionRow title={t("fields.faceValue")} value={pool.face_value != null ? String(pool.face_value) : null} />
                    <SectionRow title={t("fields.howToUse")} value={pool.how_to_use} />
                  </>
                )}
              </Container>
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="EvoucherPoolImportCodes">
              <ImportCodes poolId={poolId} />
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="EvoucherPoolCodesTable">
              <CodesTable poolId={poolId} />
            </LayoutComposer.Entry>
          </>
        ),
      }}
    />
  )
}

type PoolLoaderData = Awaited<ReturnType<typeof evoucherApi.retrievePool>>

// breadcrumb แสดงชื่อ pool (loader โหลดตอนเข้า route)
export const loader = async ({ params }: LoaderFunctionArgs) =>
  evoucherApi.retrievePool(params.id!)

// spec 10 กฎ 4b: fallback แปลด้วย helper t (alias tNs ไม่ซ้อนกับ t ของ useTranslation — AI18N-N1) ตอนรัน (ชื่อ pool จาก loader คงเดิม)
export const handle = {
  breadcrumb: ({ loaderData }: UIMatch<PoolLoaderData>) =>
    loaderData?.pool.name ?? tNs("ecom-evoucher", "pool.breadcrumb"),
}

export default PoolPage
