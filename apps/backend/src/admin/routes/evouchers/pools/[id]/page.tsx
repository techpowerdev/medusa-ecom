import { LayoutComposer, SectionRow } from "@medusajs/dashboard/components"
import { Badge, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { LoaderFunctionArgs, UIMatch, useLoaderData, useParams } from "react-router-dom"
import { Container } from "../../../../components/common/container"
import { Header } from "../../../../components/common/header"
import { CodesTable } from "../../../../components/evoucher/codes-table"
import { ImportCodes } from "../../../../components/evoucher/import-codes"
import { CODE_STATUSES, evoucherApi, evoucherKeys, STATUS_COLOR } from "../../../../lib/evoucher"

// EV-6: รายละเอียด pool — จำนวน code ต่อสถานะ, import CSV, รายการ code (masked) + reveal (audit)
// ADM-4: LayoutComposer (core:single-column) + Header + SectionRow ของ dashboard
const PoolPage = () => {
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
                  title={isLoading ? "Loading…" : (pool?.name ?? "")}
                  actions={[
                    ...(pool?.low_stock
                      ? [
                          {
                            type: "custom" as const,
                            children: (
                              <Badge size="2xsmall" color="red">
                                Low stock (&lt; {pool.low_stock_threshold})
                              </Badge>
                            ),
                          },
                        ]
                      : []),
                    {
                      type: "button",
                      props: { variant: "secondary", children: "All pools" },
                      link: { to: "/evouchers" },
                    },
                  ]}
                />
                {pool && (
                  <div className="grid grid-cols-4 gap-x-4 px-6 py-4">
                    {CODE_STATUSES.map((status) => (
                      <div key={status} className="flex flex-col gap-y-1">
                        <Badge size="2xsmall" color={STATUS_COLOR[status]} className="w-fit">
                          {status}
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
                    <SectionRow title="Partner" value={pool.partner.name} />
                    <SectionRow title="Face value" value={pool.face_value != null ? String(pool.face_value) : null} />
                    <SectionRow title="How to use" value={pool.how_to_use} />
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

export const handle = {
  breadcrumb: ({ loaderData }: UIMatch<PoolLoaderData>) => loaderData?.pool.name ?? "Pool",
}

export default PoolPage
