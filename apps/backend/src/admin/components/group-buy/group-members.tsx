import {
  Badge,
  Button,
  createDataTableColumnHelper,
  DataTable,
  DataTablePaginationState,
  Text,
  toast,
  useDataTable,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { canSetGroupOutcome, customerLabel, orderAdminPath } from "../../lib/group-buy-campaign"
import { formatDateTime, Group, groupBuyApi, groupBuyKeys, Membership } from "../../lib/group-buy"

type Outcome = "succeed" | "fail"

const PROMPTS: Record<Outcome, { title: string; description: string; confirmText: string }> = {
  succeed: {
    title: "Mark group as succeeded?",
    description: "Members get a payment request for their draft orders. This cannot be undone.",
    confirmText: "Succeed",
  },
  fail: {
    title: "Mark group as failed?",
    description: "All member draft orders are canceled. This cannot be undone.",
    confirmText: "Fail",
  },
}

const columnHelper = createDataTableColumnHelper<Membership>()
const columns = [
  columnHelper.accessor(customerLabel, { id: "customer", header: "Customer" }),
  columnHelper.accessor("units", { header: "Units" }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
  }),
  columnHelper.accessor("order_id", {
    header: "Order",
    cell: ({ row }) => (
      <Link to={orderAdminPath(row.original)} data-testid="gb-membership-order-link">
        <Text size="small" className="text-ui-fg-interactive">
          {row.original.order_id}
        </Text>
      </Link>
    ),
  }),
  columnHelper.accessor((m) => m.order?.payment_status ?? "-", { id: "payment_status", header: "Payment" }),
  columnHelper.accessor((m) => formatDateTime(m.joined_at), { id: "joined_at", header: "Joined (ICT)" }),
]

// GB-6c (spec 04 Admin UI, AC-35): membership ของกลุ่มที่เลือก + succeed/fail แบบ manual (route ของ GB-4)
export const GroupMembers = ({ group, campaignId }: { group: Group; campaignId: string }) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 20 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading } = useQuery({
    queryKey: [...groupBuyKeys.memberships(group.id), limit, offset],
    queryFn: () => groupBuyApi.listMemberships(group.id, { limit, offset }),
    placeholderData: keepPreviousData,
  })

  // กฎข้อ 17: ref ตั้งทันทีก่อน await prompt — dblclick ไม่ยิงซ้ำ
  const inFlight = useRef(false)
  const outcome = useMutation({
    mutationFn: (action: Outcome) => groupBuyApi.setOutcome(group.id, action),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.groups(campaignId) })
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.memberships(group.id) })
      toast.success(action === "succeed" ? "Group succeeded" : "Group failed")
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      inFlight.current = false
    },
  })
  const onOutcome = async (action: Outcome) => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    if (!(await prompt({ ...PROMPTS[action], cancelText: "Cancel" }))) {
      inFlight.current = false
      return
    }
    outcome.mutate(action)
  }

  const table = useDataTable({
    data: data?.memberships ?? [],
    columns,
    getRowId: (m) => m.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          Members of {group.name ?? group.join_token}
        </Text>
        {canSetGroupOutcome(group) && (
          <div className="flex items-center gap-x-2">
            <Button
              size="small"
              variant="secondary"
              data-testid="gb-group-succeed"
              onClick={() => onOutcome("succeed")}
              disabled={outcome.isPending}
            >
              Mark succeeded
            </Button>
            <Button
              size="small"
              variant="danger"
              data-testid="gb-group-fail"
              onClick={() => onOutcome("fail")}
              disabled={outcome.isPending}
            >
              Mark failed
            </Button>
          </div>
        )}
      </div>
      <div data-testid="gb-memberships-table">
        <DataTable instance={table}>
          <DataTable.Table emptyState={{ empty: { heading: "No members yet" } }} />
          <DataTable.Pagination />
        </DataTable>
      </div>
    </div>
  )
}
