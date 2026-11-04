import { useDate } from "@medusajs/dashboard/hooks"
import { Badge, Button, createDataTableColumnHelper, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { AdminAffiliate, affiliateKeys, updateAffiliate } from "../../lib/affiliate"
import { affiliateAction } from "../../lib/affiliate-account"
import { createSingleFlight } from "../../lib/single-flight"
import { AffiliateListTable, useAffiliateList } from "./list-table"
import { PayoutInfoDrawer } from "./payout-info-drawer"

const columnHelper = createDataTableColumnHelper<AdminAffiliate>()

const STATUS_COLOR = { pending: "orange", active: "green", suspended: "red" } as const

type Update = { id: string; body: Parameters<typeof updateAffiliate>[1] }

// AF-12b (spec 05 กฎ 37b, AC-43): แท็บ Affiliates — approve/suspend/reactivate + ข้อมูลรับเงิน
export const AffiliatesTable = () => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const { getFullDate } = useDate()
  const list = useAffiliateList<AdminAffiliate>("affiliates", "affiliates")
  const [editing, setEditing] = useState<AdminAffiliate | null>(null)
  // instance คงที่ตลอดอายุ component (กฎ 37) — dblclick หรือกดระหว่าง prompt เปิด = ไม่ยิงซ้ำ
  const [actOnce] = useState(createSingleFlight)

  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("affiliates") })

  const update = useMutation({
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

  const changeStatus = (row: AdminAffiliate) =>
    actOnce(async () => {
      const action = affiliateAction(row.status)
      if (action.confirm) {
        const ok = await prompt({
          title: `Suspend ${row.name}?`,
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
        .mutateAsync({ id: row.id, body: { status: action.status, expected_status: row.status } })
        .catch(() => undefined)
    })

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
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => {
          const action = affiliateAction(row.original.status)
          return (
            <div className="flex gap-x-2">
              <Button
                size="small"
                variant="secondary"
                data-testid={action.testId}
                disabled={update.isPending}
                onClick={() => changeStatus(row.original)}
              >
                {action.label}
              </Button>
              <Button
                size="small"
                variant="transparent"
                data-testid="affiliate-payout-info-edit"
                onClick={() => setEditing(row.original)}
              >
                Payout info
              </Button>
            </div>
          )
        },
      }),
      columnHelper.accessor("created_at", {
        header: "Joined",
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
    ],
    // changeStatus ใช้ actOnce/prompt/mutateAsync ที่ stable — สร้างคอลัมน์ใหม่เมื่อ isPending/getFullDate เปลี่ยน
    [update.isPending, getFullDate],
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
