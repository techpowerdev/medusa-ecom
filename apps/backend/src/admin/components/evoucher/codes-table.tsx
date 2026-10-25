import {
  Badge,
  Button,
  Container,
  Copy,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Drawer,
  Heading,
  Select,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  CODE_STATUSES,
  CodeStatus,
  evoucherApi,
  evoucherKeys,
  formatDate,
  MaskedCode,
  RevealedCode,
  STATUS_COLOR,
} from "../../lib/evoucher"

const columnHelper = createDataTableColumnHelper<MaskedCode>()
const ALL = "all"

// รายการ code แบบ masked (AC-8); ค่าจริงดูได้ทีละ code ผ่าน reveal ซึ่ง backend เขียน audit ทุกครั้ง
export const CodesTable = ({ poolId }: { poolId: string }) => {
  const prompt = usePrompt()
  const [status, setStatus] = useState<CodeStatus | typeof ALL>(ALL)
  const [revealed, setRevealed] = useState<RevealedCode | null>(null)
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [...evoucherKeys.codes(poolId), status, limit, offset],
    queryFn: () =>
      evoucherApi.listCodes(poolId, {
        limit,
        offset,
        ...(status === ALL ? {} : { status }),
      }),
    placeholderData: keepPreviousData,
  })

  // useMutation (ไม่ใช่ useQuery) เพื่อไม่ให้ค่าจริงค้างใน query cache
  const reveal = useMutation({
    mutationFn: (id: string) => evoucherApi.revealCode(id),
    onSuccess: (res) => setRevealed(res.code),
    onError: (e: Error) => toast.error(e.message),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor("code", {
        header: "Code",
        cell: ({ getValue }) => <span className="font-mono">{getValue()}</span>,
      }),
      columnHelper.accessor("has_pin", {
        header: "PIN",
        cell: ({ getValue }) => (getValue() ? "****" : "-"),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={STATUS_COLOR[getValue()]}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("expires_at", {
        header: "Expires",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      columnHelper.accessor("order_id", {
        header: "Order",
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      columnHelper.display({
        id: "reveal",
        cell: ({ row }) => (
          <Button
            size="small"
            variant="secondary"
            disabled={reveal.isPending}
            onClick={async () => {
              const ok = await prompt({
                title: "Reveal code?",
                description: "The real code and PIN will be shown. This action is recorded in the audit log.",
                confirmText: "Reveal",
                cancelText: "Cancel",
                variant: "confirmation",
              })
              if (ok) {
                reveal.mutate(row.original.id)
              }
            }}
          >
            Reveal
          </Button>
        ),
      }),
    ],
    [prompt, reveal]
  )

  const table = useDataTable({
    data: data?.codes ?? [],
    columns,
    getRowId: (code) => code.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <Container className="divide-y p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Codes</Heading>
          <div className="w-40">
            <Select
              size="small"
              value={status}
              onValueChange={(value) => {
                setStatus(value as CodeStatus | typeof ALL)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
            >
              <Select.Trigger aria-label="Filter by status">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={ALL}>All statuses</Select.Item>
                {CODE_STATUSES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {s}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </DataTable.Toolbar>
        <DataTable.Table
          emptyState={{ empty: { heading: "No codes", description: "Import a CSV to add codes." } }}
        />
        <DataTable.Pagination />
      </DataTable>

      <Drawer open={!!revealed} onOpenChange={(open) => !open && setRevealed(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Revealed code</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 p-4">
            {revealed && (
              <>
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    Code
                  </Text>
                  <div className="flex items-center gap-x-2">
                    <Text className="font-mono" data-testid="evoucher-revealed-code">
                      {revealed.code}
                    </Text>
                    <Copy content={revealed.code} />
                  </div>
                </div>
                <div className="flex flex-col gap-y-1">
                  <Text size="small" weight="plus">
                    PIN
                  </Text>
                  <Text className="font-mono">{revealed.pin ?? "-"}</Text>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  Expires {formatDate(revealed.expires_at)} · This reveal was recorded in the audit log.
                </Text>
              </>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
