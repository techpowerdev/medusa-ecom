import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "react-router-dom"
import { CodesTable } from "../../../../components/evoucher/codes-table"
import { ImportCodes } from "../../../../components/evoucher/import-codes"
import { CODE_STATUSES, evoucherApi, evoucherKeys, STATUS_COLOR } from "../../../../lib/evoucher"

// EV-6: รายละเอียด pool — จำนวน code ต่อสถานะ, import CSV, รายการ code (masked) + reveal (audit)
const PoolPage = () => {
  const { id } = useParams()
  const poolId = id!

  const { data, isLoading } = useQuery({
    queryKey: evoucherKeys.pool(poolId),
    queryFn: () => evoucherApi.retrievePool(poolId),
  })
  const pool = data?.pool

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex flex-col gap-y-1">
            <Heading level="h1">{isLoading ? "Loading…" : pool?.name}</Heading>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {pool?.partner.name}
              {pool?.face_value != null ? ` · Face value ${pool.face_value}` : ""}
            </Text>
          </div>
          <div className="flex items-center gap-x-2">
            {pool?.low_stock && (
              <Badge size="2xsmall" color="red">
                Low stock (&lt; {pool.low_stock_threshold})
              </Badge>
            )}
            <Link to="/evouchers">
              <Text size="small" className="text-ui-fg-interactive">
                All pools
              </Text>
            </Link>
          </div>
        </div>
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
          <div className="flex flex-col gap-y-1 px-6 py-4">
            <Text size="small" leading="compact" weight="plus">
              How to use
            </Text>
            <Text size="small" className="text-ui-fg-subtle whitespace-pre-line">
              {pool.how_to_use}
            </Text>
          </div>
        )}
      </Container>
      <ImportCodes poolId={poolId} />
      <CodesTable poolId={poolId} />
    </div>
  )
}

export default PoolPage
