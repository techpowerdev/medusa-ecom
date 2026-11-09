import { ActionMenu } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { ArrowPath, CheckCircle, EllipsisHorizontal, PencilSquare, XCircle } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, IconButton, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useReducer, useState } from "react"
import { AdminAffiliate, affiliateKeys, updateAffiliate } from "../../lib/affiliate"
import { affiliateAction } from "../../lib/affiliate-account"
import { createSingleFlight } from "../../lib/single-flight"
import { AffiliateListTable, useAffiliateList } from "./list-table"
import { PayoutInfoDrawer } from "./payout-info-drawer"

const columnHelper = createDataTableColumnHelper<AdminAffiliate>()

const STATUS_COLOR = { pending: "orange", active: "green", suspended: "red" } as const
const STATUS_ICON = { pending: <CheckCircle />, active: <XCircle />, suspended: <ArrowPath /> } as const

type Update = { id: string; body: Parameters<typeof updateAffiliate>[1] }

// แถว (สถานะ) และ drawer ข้อมูลรับเงินใช้ mutation แบบเดียวกัน
const useUpdateAffiliate = () => {
  const queryClient = useQueryClient()
  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("affiliates") })
  return useMutation({
    mutationFn: ({ id, body }: Update) => updateAffiliate(id, body),
    onSuccess: () => {
      toast.success("Affiliate updated")
      return refetch()
    },
    // ล้ม (เช่น สถานะถูกเปลี่ยนไปแล้ว 409 AFFILIATE_STATUS_CHANGED) → toast ข้อความจาก API แล้วโหลดรายการใหม่ (กฎ 37)
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })
}

/**
 * ADM-8b (spec 08 AC-13, กฎ 4, 10): ปุ่มต่อแถวใน ActionMenu — ถือ prompt/mutation สถานะของแถวเอง (แบบ `*Actions` ของ dashboard)
 * drawer ข้อมูลรับเงินอยู่นอกตาราง (render ใน cell แล้ว Escape ครั้งแรกไม่ปิด)
 */
const AffiliateActions = ({
  affiliate,
  onEditPayoutInfo,
}: {
  affiliate: AdminAffiliate
  onEditPayoutInfo: (a: AdminAffiliate) => void
}) => {
  const prompt = usePrompt()
  // instance คงที่ตลอดอายุ component (กฎ 4) — กด menuitem ซ้ำหรือกดระหว่าง prompt เปิด = ไม่ยิงซ้ำ
  const [actOnce] = useState(createSingleFlight)
  // เปิด modal/drawer จาก menuitem: mount เมนูใหม่ใน commit เดียวกัน (ปิดทันทีไม่รอ animation) — ไม่งั้น Radix คนละสำเนา
  // ของเมนูกับ modal คืนค่า pointer-events ของ body สลับกันจนหน้าเป็น `none` ค้างหลังปิด modal (คลิกอะไรไม่ได้)
  const [menuKey, remountMenu] = useReducer((k: number) => k + 1, 0)
  const update = useUpdateAffiliate()

  const action = affiliateAction(affiliate.status)
  const changeStatus = () =>
    actOnce(async () => {
      if (action.confirm) {
        const ok = await prompt({
          title: `Suspend ${affiliate.name}?`,
          description: "The affiliate stops earning new commission until reactivated.",
          confirmText: "Suspend",
          cancelText: "Cancel",
        })
        if (!ok) {
          return
        }
      }
      // AF-15 (กฎ 39b): ส่งสถานะที่แถวแสดงเสมอ — แท็บอื่นเปลี่ยนไปแล้ว → 409 → toast + refetch (onError)
      await update
        .mutateAsync({ id: affiliate.id, body: { status: action.status, expected_status: affiliate.status } })
        .catch(() => undefined)
    })

  return (
    <ActionMenu
      key={menuKey}
      groups={[
        {
          actions: [
            {
              label: action.label,
              icon: STATUS_ICON[affiliate.status],
              disabled: update.isPending,
              onClick: changeStatus,
            },
          ],
        },
        {
          actions: [
            {
              label: "Payout info",
              icon: <PencilSquare />,
              onClick: () => {
                remountMenu()
                onEditPayoutInfo(affiliate)
              },
            },
          ],
        },
      ]}
    >
      <IconButton size="small" variant="transparent" data-testid="affiliate-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// AF-12b (spec 05 กฎ 37b, AC-43): แท็บ Affiliates — approve/suspend/reactivate + ข้อมูลรับเงิน
export const AffiliatesTable = () => {
  const { getFullDate } = useDate()
  const list = useAffiliateList<AdminAffiliate>("affiliates", "affiliates")
  const [editing, setEditing] = useState<AdminAffiliate | null>(null)
  const update = useUpdateAffiliate()

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount แถวใหม่และเมนูที่เปิดอยู่ปิดเองตอน refetch
  const actionsColumn = useMemo(
    () =>
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => <AffiliateActions affiliate={row.original} onEditPayoutInfo={setEditing} />,
      }),
    [],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", { header: "Name" }),
      columnHelper.accessor("email", { header: "Email" }),
      columnHelper.accessor("code", { header: "Code" }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={STATUS_COLOR[getValue()]} data-testid="affiliate-status">
            {getValue()}
          </Badge>
        ),
      }),
      actionsColumn,
      columnHelper.accessor("created_at", {
        header: "Joined",
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
    ],
    [actionsColumn, getFullDate],
  )

  return (
    <>
      <AffiliateListTable
        {...list}
        columns={columns}
        heading="Affiliates"
        subHeading="Approve applicants and manage payout info."
        empty="No affiliates yet"
      />
      {editing && (
        <PayoutInfoDrawer
          key={editing.id}
          affiliate={editing}
          onClose={() => setEditing(null)}
          save={(payout_info) => update.mutateAsync({ id: editing.id, body: { payout_info } })}
        />
      )}
    </>
  )
}
