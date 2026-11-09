import { ActionMenu } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { castNumber, getLocaleAmount } from "@medusajs/dashboard/lib"
import { CheckCircle, EllipsisHorizontal, XCircle } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, IconButton, toast, usePrompt } from "@medusajs/ui"
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useReducer, useState } from "react"
import { affiliateKeys, cancelPayout, Payout } from "../../lib/affiliate"
import { canCancelPayout, canMarkPaid } from "../../lib/affiliate-payout"
import { createSingleFlight } from "../../lib/single-flight"
import { Header } from "../common/header"
import { AffiliateCell, AffiliateListTable, useAffiliateList, useAffiliateNames } from "./list-table"
import { MarkPaidPrompt } from "./mark-paid-prompt"
import { PayoutFormModal } from "./payout-form"

const columnHelper = createDataTableColumnHelper<Payout>()

/**
 * ADM-8b (spec 08 AC-13, กฎ 4, 10): Mark paid/Cancel ต่อแถวใน ActionMenu — ถือ prompt/mutation ยกเลิกของแถวเอง (แบบ `*Actions` ของ dashboard)
 * และกันกัน (nit #176): cancel และ mark paid ของ payout เดียวกันใช้ `mutationKey` เดียวกัน (`affiliateKeys.payoutAction`)
 * → ระหว่างอันใดอันหนึ่งกำลังส่ง (รวม refetch หลังสำเร็จ) ทั้ง Mark paid และ Cancel disabled; นับจาก mutation cache ของ Tanstack
 * จึงไม่หายแม้ cell ถูก mount ใหม่ (review #316) — กล่อง mark paid อยู่นอกตาราง (render ใน cell แล้ว Escape ครั้งแรกไม่ปิด)
 */
const PayoutActions = ({ payout, onMarkPaid }: { payout: Payout; onMarkPaid: (p: Payout) => void }) => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  // กล่องยืนยันเปิดอยู่หรือ request ยังไม่จบ → กด Cancel ซ้ำถูกข้าม (กฎ 4)
  const [cancelOnce] = useState(createSingleFlight)
  // เปิด modal/drawer จาก menuitem: mount เมนูใหม่ใน commit เดียวกัน (ปิดทันทีไม่รอ animation) — ไม่งั้น Radix คนละสำเนา
  // ของเมนูกับ modal คืนค่า pointer-events ของ body สลับกันจนหน้าเป็น `none` ค้างหลังปิด modal (คลิกอะไรไม่ได้)
  const [menuKey, remountMenu] = useReducer((k: number) => k + 1, 0)

  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("payouts") })
  const mutationKey = affiliateKeys.payoutAction(payout.id)
  const busy = useIsMutating({ mutationKey }) > 0
  const cancel = useMutation({
    mutationKey,
    mutationFn: cancelPayout,
    onSuccess: () => {
      toast.success("Payout cancelled")
      return refetch()
    },
    // รอบ 10: ยกเลิกไม่สำเร็จ (เช่น ถูก mark paid ไปแล้ว) → โหลดรายการใหม่ให้ตารางแสดงสถานะจริง
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })

  const confirmCancel = () =>
    cancelOnce(async () => {
      const ok = await prompt({
        title: "Cancel this draft payout?",
        description: "The payout is removed and its entries can be picked up by the next payout.",
        confirmText: "Cancel payout",
        cancelText: "Keep payout",
      })
      if (ok) {
        await cancel.mutateAsync(payout.id).catch(() => undefined)
      }
    })

  const actions = [
    ...(canMarkPaid(payout)
      ? [
          {
            label: "Mark paid",
            icon: <CheckCircle />,
            disabled: busy,
            onClick: () => {
              remountMenu()
              onMarkPaid(payout)
            },
          },
        ]
      : []),
    ...(canCancelPayout(payout)
      ? [
          {
            label: "Cancel",
            icon: <XCircle />,
            disabled: busy,
            onClick: confirmCancel,
          },
        ]
      : []),
  ]

  // แถวที่ไม่มี action (paid/cancelled) ไม่ render trigger (spec 08 กฎ 10)
  return actions.length ? (
    <ActionMenu key={menuKey} groups={[{ actions }]}>
      <IconButton size="small" variant="transparent" data-testid="affiliate-payout-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  ) : null
}

// AF-6 (spec 05 AC-26): เฉพาะแถว `draft` มีปุ่มยกเลิก (route ของ AF-9) ยืนยันด้วย usePrompt และกันกดซ้ำ
// AF-12c (กฎ 37c): ปุ่มสร้าง payout (FocusModal) และ mark paid ต่อแถว `draft` (Prompt พร้อมช่อง reference)
export const PayoutsTable = () => {
  const { getFullDate } = useDate()
  const list = useAffiliateList<Payout>("payouts", "payouts")
  const rows = useAffiliateNames(list.rows)
  // `opened` เป็น key ให้ฟอร์ม/กล่องยืนยัน mount ใหม่ทุกครั้งที่เปิด (ค่าเริ่มต้นสด)
  const [creating, setCreating] = useState<number>()
  const [markingPaid, setMarkingPaid] = useState<{ payout: Payout; opened: number }>()

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount `PayoutActions` ทุกแถวใหม่ (state ของแถวหาย และเมนูที่เปิดอยู่ปิดเอง)
  const actionsColumn = useMemo(
    () =>
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <PayoutActions
            payout={row.original}
            onMarkPaid={(payout) => setMarkingPaid((m) => m ?? { payout, opened: Date.now() })}
          />
        ),
      }),
    [],
  )

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
      actionsColumn,
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
    [actionsColumn, getFullDate],
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
