import {
  Badge,
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Heading,
  toast,
  useDataTable,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { campaignActions, groupProgress } from "../../lib/group-buy-campaign"
import { Campaign, formatDateTime, Group, groupBuyApi, groupBuyKeys } from "../../lib/group-buy"
import { GroupMembers } from "./group-members"

const GROUP_STATUS_COLOR = { open: "blue", succeeded: "green", failed: "red" } as const
const columnHelper = createDataTableColumnHelper<Group>()

// GB-6b (spec 04 Admin UI, AC-31): ตารางกลุ่มของแคมเปญ + สร้าง pool group
export const GroupsSection = ({ campaign }: { campaign: Campaign }) => {
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 20 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading, isPlaceholderData } = useQuery({
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

  // กฎข้อ 17: in-flight guard แบบ synchronous — isPending ยังไม่เปลี่ยนระหว่างสองคลิกใน task เดียว
  const inFlight = useRef(false)
  const createPool = useMutation({
    mutationFn: () => groupBuyApi.createPoolGroup(campaign.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.groups(campaign.id) })
      toast.success("Pool group created")
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      inFlight.current = false
    },
  })
  const onCreatePool = () => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    createPool.mutate()
  }

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
      columnHelper.accessor((g) => formatDateTime(g.ends_at), { id: "ends_at", header: "Ends (ICT)" }),
      columnHelper.accessor("join_token", { header: "Join token" }),
    ],
    [campaign, selectedId]
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

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Groups</Heading>
        {campaignActions(campaign).createPool && (
          <Button
            size="small"
            variant="secondary"
            data-testid="gb-create-pool-group"
            onClick={onCreatePool}
            isLoading={createPool.isPending}
            disabled={createPool.isPending}
          >
            Create pool group
          </Button>
        )}
      </div>
      <div
        data-testid="gb-groups-table"
        className="[&_tbody_tr:has([data-testid=gb-group-selected])]:bg-ui-bg-highlight"
      >
        <DataTable instance={table}>
          <DataTable.Table
            emptyState={{
              empty: { heading: "No groups yet", description: "Pool groups are created here; teams by customers." },
            }}
          />
          <DataTable.Pagination />
        </DataTable>
      </div>
      {selected && (
        <GroupMembers key={selected.id} group={selected} campaignId={campaign.id} onClose={() => setSelectedId(null)} />
      )}
    </Container>
  )
}
