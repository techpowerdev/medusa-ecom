import { useDate } from "@medusajs/dashboard/hooks"
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
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { canSetGroupOutcome, customerLabel, orderAdminPath } from "../../lib/group-buy-campaign"
import { isUnauthorized } from "../../lib/fetch-error"
import { Group, groupBuyApi, groupBuyKeys, Membership } from "../../lib/group-buy"
import { createSingleFlight } from "../../lib/single-flight"

type Outcome = "succeed" | "fail"

const columnHelper = createDataTableColumnHelper<Membership>()
// วันเวลาแสดงด้วย useDate ของ Medusa (timezone ของเครื่องแอดมิน — spec 08 กฎ 5)
// spec 10 กฎ 7 (AI18N-2): สถานะ membership แสดงด้วย key ของค่า; payment_status เป็นค่าของ Medusa จาก backend แสดงตามเดิม
const useColumns = () => {
  const { t } = useTranslation("ecom-group-buy")
  const { getFullDate } = useDate()
  return useMemo(
    () => [
      columnHelper.accessor(customerLabel, { id: "customer", header: t("members.columns.customer") }),
      columnHelper.accessor("units", { header: t("members.columns.units") }),
      columnHelper.accessor("status", {
        header: t("members.columns.status"),
        cell: ({ getValue }) => (
          <Badge size="2xsmall">{t(`membershipStatus.${getValue()}`, { defaultValue: getValue() })}</Badge>
        ),
      }),
      columnHelper.accessor("order_id", {
        header: t("members.columns.order"),
        cell: ({ row }) => (
          <Link to={orderAdminPath(row.original)} data-testid="gb-membership-order-link">
            <Text size="small" className="text-ui-fg-interactive">
              {row.original.order_id}
            </Text>
          </Link>
        ),
      }),
      columnHelper.accessor((m) => m.order?.payment_status ?? "-", {
        id: "payment_status",
        header: t("members.columns.payment"),
      }),
      columnHelper.accessor((m) => (m.joined_at ? getFullDate({ date: m.joined_at, includeTime: true }) : "-"), {
        id: "joined_at",
        header: t("members.columns.joinedAt"),
      }),
    ],
    [getFullDate, t]
  )
}

// GB-6c (spec 04 Admin UI, AC-35): membership ของกลุ่มที่เลือก + succeed/fail แบบ manual (route ของ GB-4)
export const GroupMembers = ({
  group,
  campaignId,
  onClose,
}: {
  group: Group
  campaignId: string
  onClose: () => void
}) => {
  const { t } = useTranslation("ecom-group-buy")
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const columns = useColumns()
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 20 })
  const limit = pagination.pageSize
  const offset = pagination.pageIndex * limit

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...groupBuyKeys.memberships(group.id), limit, offset],
    queryFn: () => groupBuyApi.listMemberships(group.id, { limit, offset }),
    placeholderData: keepPreviousData,
  })

  // กฎข้อ 17 / spec 08 กฎ 4: guard ตั้งทันทีก่อน await prompt — dblclick ไม่ยิงซ้ำ
  const [outcomeOnce] = useState(createSingleFlight)
  const outcome = useMutation({
    mutationFn: (action: Outcome) => groupBuyApi.setOutcome(group.id, action),
    onSuccess: (_, action) =>
      toast.success(action === "succeed" ? t("members.toast.succeeded") : t("members.toast.failed")),
    onError: (e: Error) => toast.error(e.message),
    // GB-6d (กฎข้อ 23): refetch ทั้งตอนสำเร็จและล้ม — ล้ม (4xx) มักแปลว่ากลุ่มเปลี่ยนสถานะไปแล้ว ตารางต้องตรง DB
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.groups(campaignId) })
      queryClient.invalidateQueries({ queryKey: groupBuyKeys.memberships(group.id) })
    },
  })
  // spec 10 กฎ 4e (AI18N-2): ข้อความ prompt ย้ายจากค่าคงที่ระดับ module เข้า component เพื่อเรียก t ตอน render
  const prompts: Record<Outcome, { title: string; description: string; confirmText: string }> = {
    succeed: {
      title: t("members.prompts.succeed.title"),
      description: t("members.prompts.succeed.description"),
      confirmText: t("members.prompts.succeed.confirm"),
    },
    fail: {
      title: t("members.prompts.fail.title"),
      description: t("members.prompts.fail.description"),
      confirmText: t("members.prompts.fail.confirm"),
    },
  }
  const onOutcome = (action: Outcome) =>
    outcomeOnce(async () => {
      if (await prompt({ ...prompts[action], cancelText: t("actions.cancel", { ns: "translation" }) })) {
        await outcome.mutateAsync(action).catch(() => undefined)
      }
    })

  const table = useDataTable({
    data: data?.memberships ?? [],
    columns,
    getRowId: (m) => m.id,
    rowCount: data?.count ?? 0,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
  })

  // spec 08 กฎ 25 (24b): 401 → ErrorBoundary ของ dashboard พาไป /login
  if (isUnauthorized(error)) {
    throw error
  }
  // กฎ 25 (24a/d): ล้มและไม่มีข้อมูลในมือเท่านั้นจึงแสดง error (refetch เบื้องหลังล้มขณะมี data คงตารางไว้)
  const loadFailed = isError && !data

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          {t("members.title", { name: group.name ?? group.join_token })}
        </Text>
        <div className="flex items-center gap-x-2">
          {canSetGroupOutcome(group) && (
            <>
              <Button
                size="small"
                variant="secondary"
                data-testid="gb-group-succeed"
                onClick={() => onOutcome("succeed")}
                disabled={outcome.isPending}
              >
                {t("members.markSucceeded")}
              </Button>
              <Button
                size="small"
                variant="danger"
                data-testid="gb-group-fail"
                onClick={() => onOutcome("fail")}
                disabled={outcome.isPending}
              >
                {t("members.markFailed")}
              </Button>
            </>
          )}
          <Button size="small" variant="transparent" data-testid="gb-memberships-close" onClick={onClose}>
            {t("members.close")}
          </Button>
        </div>
      </div>
      <div data-testid="gb-memberships-table">
        {/* กฎ 25: DataTable ไม่มี prop error → แสดง error ผ่าน emptyState คงหัว + ปุ่ม; testid เฉพาะตอนล้ม */}
        <div data-testid={loadFailed ? "gb-memberships-error" : undefined}>
          <DataTable instance={table}>
            <DataTable.Table
              emptyState={{
                empty: loadFailed
                  ? { heading: t("members.loadError"), description: error?.message }
                  : { heading: t("members.emptyHeading") },
              }}
            />
            {/* spec 08 กฎ 29a: ตอน error ไม่มีแถบแบ่งหน้า ("0 of 0 results") */}
            {!loadFailed && <DataTable.Pagination />}
          </DataTable>
        </div>
      </div>
    </div>
  )
}
