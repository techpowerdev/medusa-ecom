import { useDate } from "@medusajs/dashboard/hooks"
import {
  Badge,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { Container } from "../common/container"
import { Header } from "../common/header"
import { isUnauthorized } from "../../lib/fetch-error"
import { createSingleFlight } from "../../lib/single-flight"
import { campaignActions, groupProgress } from "../../lib/group-buy-campaign"
import { Campaign, Group, groupBuyApi, groupBuyKeys } from "../../lib/group-buy"
import { GroupMembers } from "./group-members"

const GROUP_STATUS_COLOR = { open: "blue", succeeded: "green", failed: "red" } as const
const columnHelper = createDataTableColumnHelper<Group>()

// GB-6b (spec 04 Admin UI, AC-31): ตารางกลุ่มของแคมเปญ + สร้าง pool group
export const GroupsSection = ({ campaign }: { campaign: Campaign }) => {
  const queryClient = useQueryClient()
  const { getFullDate } = useDate()
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 20 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading, isPlaceholderData, isError, error } = useQuery({
    queryKey: [...groupBuyKeys.groups(campaign.id), limit, offset],
    queryFn: () => groupBuyApi.listGroups(campaign.id, { limit, offset }),
    placeholderData: keepPreviousData,
  })
  // GB-6c (AC-35): คลิกแถวกลุ่มเพื่อเปิดรายการ membership — อ่านกลุ่มจาก data ล่าสุดให้ status อัปเดตหลัง succeed/fail
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data?.groups.find((g) => g.id === selectedId)
  // GB-6d (กฎข้อ 23): หน้าใหม่โหลดเสร็จแล้วไม่มีแถวที่เลือก → ปิด selection (ไม่เปิดค้างเมื่อกลับหน้าเดิม)
  useEffect(() => {
    if (selectedId && data && !isPlaceholderData && !selected) {
      setSelectedId(null)
    }
  }, [selectedId, data, isPlaceholderData, selected])

  // กฎข้อ 17 / spec 08 กฎ 4: guard ตั้งทันทีก่อน await — สองคลิกใน task เดียว (isPending ยังไม่เปลี่ยน) ไม่ยิงซ้ำ
  const [createOnce] = useState(createSingleFlight)
  const createPool = useMutation({
    mutationFn: () => groupBuyApi.createPoolGroup(campaign.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.groups(campaign.id) })
      toast.success("Pool group created")
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const onCreatePool = () => createOnce(() => createPool.mutateAsync().catch(() => undefined))

  const columns = useMemo(
    () => [
      columnHelper.accessor("kind", {
        header: "Kind",
        // marker ของแถวที่เลือก — wrapper ของตารางใช้ :has() ทำ highlight ทั้งแถว (DataTable ไม่รับ className ต่อแถว)
        cell: ({ getValue, row }) => (
          <>
            {getValue()}
            {row.id === selectedId && (
              <span data-testid="gb-group-selected" className="sr-only">
                (selected)
              </span>
            )}
          </>
        ),
      }),
      columnHelper.accessor("name", { header: "Name", cell: ({ getValue }) => getValue() ?? "-" }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={GROUP_STATUS_COLOR[getValue()]}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor((g) => groupProgress(g, campaign), { id: "progress", header: "Progress" }),
      columnHelper.accessor((g) => (g.ends_at ? getFullDate({ date: g.ends_at, includeTime: true }) : "-"), {
        id: "ends_at",
        header: "Ends (ICT)",
      }),
      columnHelper.accessor("join_token", { header: "Join token" }),
    ],
    [campaign, selectedId, getFullDate]
  )

  const table = useDataTable({
    data: data?.groups ?? [],
    columns,
    getRowId: (g) => g.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_, g) => setSelectedId(g.id),
  })

  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  return (
    <Container>
      <Header
        title="Groups"
        actions={
          campaignActions(campaign).createPool
            ? [
                {
                  type: "button",
                  props: {
                    variant: "secondary",
                    "data-testid": "gb-create-pool-group",
                    onClick: onCreatePool,
                    isLoading: createPool.isPending,
                    disabled: createPool.isPending,
                    children: "Create pool group",
                  },
                },
              ]
            : []
        }
      />
      {/* กฎข้อ 24a: highlight ที่ระดับ td ด้วย — td แรกของ DataTable เป็น sticky มี bg-ui-bg-base (+ group-hover) ทับสีของแถว */}
      <div
        data-testid="gb-groups-table"
        className="[&_tbody_tr:has([data-testid=gb-group-selected])]:bg-ui-bg-highlight [&_tbody_tr:has([data-testid=gb-group-selected])_td]:!bg-ui-bg-highlight"
      >
        {/* กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัว + ปุ่ม Create pool group; testid เฉพาะตอนล้ม */}
        <div data-testid={loadFailed ? "gb-groups-error" : undefined}>
          <DataTable instance={table}>
            <DataTable.Table
              emptyState={{
                empty: loadFailed
                  ? { heading: "Could not load groups", description: error?.message }
                  : { heading: "No groups yet", description: "Pool groups are created here; teams by customers." },
              }}
            />
            {/* spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results") */}
            {!loadFailed && <DataTable.Pagination />}
          </DataTable>
        </div>
      </div>
      {selected && (
        <GroupMembers key={selected.id} group={selected} campaignId={campaign.id} onClose={() => setSelectedId(null)} />
      )}
    </Container>
  )
}
