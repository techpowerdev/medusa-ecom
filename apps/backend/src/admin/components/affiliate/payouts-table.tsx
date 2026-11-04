import { useDate } from "@medusajs/dashboard/hooks"
import { castNumber, getLocaleAmount } from "@medusajs/dashboard/lib"
import { Badge, Button, createDataTableColumnHelper, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useRef, useState } from "react"
import { affiliateKeys, cancelPayout, Payout } from "../../lib/affiliate"
import { canCancelPayout, canMarkPaid } from "../../lib/affiliate-payout"
import { Header } from "../common/header"
import { AffiliateCell, AffiliateListTable, useAffiliateList, useAffiliateNames } from "./list-table"
import { MarkPaidPrompt } from "./mark-paid-prompt"
import { PayoutFormModal } from "./payout-form"

const columnHelper = createDataTableColumnHelper<Payout>()

// AF-6 (spec 05 AC-26): เฉพาะแถว `draft` มีปุ่มยกเลิก (route ของ AF-9) ยืนยันด้วย usePrompt และกันกดซ้ำ
// AF-12c (กฎ 37c): ปุ่มสร้าง payout (FocusModal) และ mark paid ต่อแถว `draft` (Prompt พร้อมช่อง reference)
export const PayoutsTable = () => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const { getFullDate } = useDate()
  const list = useAffiliateList<Payout>("payouts", "payouts")
  const rows = useAffiliateNames(list.rows)
  // กล่องยืนยันเปิดอยู่หรือ request ยังไม่จบ → คลิกซ้ำ (dblclick) ถูกเพิกเฉย (ค่าคงอยู่ข้าม render)
  const inFlight = useRef(false)
  // `opened` เป็น key ให้ฟอร์ม/กล่องยืนยัน mount ใหม่ทุกครั้งที่เปิด (ค่าเริ่มต้นสด)
  const [creating, setCreating] = useState<number>()
  const [markingPaid, setMarkingPaid] = useState<{ payout: Payout; opened: number }>()

  const refetchPayouts = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("payouts") })

  const cancel = useMutation({
    mutationFn: cancelPayout,
    onSuccess: () => {
      toast.success("Payout cancelled")
      return refetchPayouts()
    },
    // รอบ 10: ยกเลิกไม่สำเร็จ (เช่น ถูก mark paid ไปแล้ว) → โหลดรายการใหม่ให้ตารางแสดงสถานะจริง
    onError: (e: Error) => {
      toast.error(e.message)
      return refetchPayouts()
    },
  })

  const confirmCancel = async (id: string) => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    try {
      const ok = await prompt({
        title: "Cancel this draft payout?",
        description: "The payout is removed and its entries can be picked up by the next payout.",
        confirmText: "Cancel payout",
        cancelText: "Keep payout",
      })
      if (ok) {
        await cancel.mutateAsync(id).catch(() => undefined)
      }
    } finally {
      inFlight.current = false
    }
  }

  // คอลัมน์สถานะ (sticky) และปุ่มอยู่ซ้ายสุด เพื่อให้ปุ่มอยู่ในจอที่ 1280px โดยไม่ต้องเลื่อนตาราง (รอบ 10)
  const columns = useMemo(
    () => [
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={getValue() === "paid" ? "green" : "orange"}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <div className="flex gap-x-2">
            {canMarkPaid(row.original) && (
              <Button
                size="small"
                variant="secondary"
                data-testid="affiliate-payout-mark-paid"
                onClick={() => setMarkingPaid((m) => m ?? { payout: row.original, opened: Date.now() })}
              >
                Mark paid
              </Button>
            )}
            {canCancelPayout(row.original) && (
              <Button
                size="small"
                variant="secondary"
                data-testid="affiliate-payout-cancel"
                disabled={cancel.isPending}
                onClick={() => confirmCancel(row.original.id)}
              >
                Cancel
              </Button>
            )}
          </div>
        ),
      }),
      // AF-14: ชื่อ/อีเมล affiliate ถัดจากปุ่ม เพื่อให้อยู่ในจอที่ 1280px
      columnHelper.accessor("affiliate_id", {
        header: "Affiliate",
        cell: ({ row }) => <AffiliateCell row={row.original} />,
      }),
      columnHelper.accessor((row) => getLocaleAmount(castNumber(row.amount), row.currency), {
        id: "amount",
        header: "Amount",
      }),
      columnHelper.accessor(
        (row) => `${getFullDate({ date: row.period_from })} – ${getFullDate({ date: row.period_to })}`,
        { id: "period", header: "Period" },
      ),
      columnHelper.accessor("paid_at", {
        header: "Paid at",
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? getFullDate({ date: value, includeTime: true }) : "-"
        },
      }),
      columnHelper.accessor("reference", { header: "Reference", cell: ({ getValue }) => getValue() ?? "-" }),
      columnHelper.accessor("id", { header: "Payout" }),
    ],
    // confirmCancel ใช้แค่ ref, prompt, mutateAsync และ setter ของ state ที่ stable — สร้างคอลัมน์ใหม่เมื่อ isPending/getFullDate เปลี่ยน
    [cancel.isPending, getFullDate],
  )

  return (
    <>
      {/* ปุ่ม Create อยู่ใน Header เพราะ `action` ของ DataTable ใส่ data-testid ไม่ได้ (e2e หาด้วย testid — กฎ 7) */}
      <Header
        title="Payouts"
        actions={[
          {
            type: "button",
            props: {
              variant: "secondary",
              "data-testid": "affiliate-payout-create",
              onClick: () => setCreating((c) => c ?? Date.now()),
              children: "Create payout",
            },
          },
        ]}
      />
      <AffiliateListTable
        {...list}
        rows={rows}
        columns={columns}
        subHeading="Draft payouts can be marked paid or cancelled."
        empty="No payouts yet"
      />
      {creating && <PayoutFormModal key={creating} onClose={() => setCreating(undefined)} />}
      {markingPaid && (
        <MarkPaidPrompt
          key={markingPaid.opened}
          payout={markingPaid.payout}
          onClose={() => setMarkingPaid(undefined)}
        />
      )}
    </>
  )
}
