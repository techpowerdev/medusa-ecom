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
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip ที่เปิดเมื่อ focus กลับมาที่ trigger กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
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
      // ตำแหน่ง (AF-14): ชื่อ/อีเมล affiliate ถัดจากปุ่ม เพื่อให้อยู่ในจอที่ 1280px
      //
      // ความกว้าง (spec 08 กฎ 41a, ADM-37): ชื่อ/อีเมลยาวถูกตัดที่ขอบ cell และมี tooltip ของ TruncatedCell (AffiliateCell ห้ามตัดที่ลูกเอง — กฎ 41b)
      // กฎ 45 (ADM-41): ตารางนี้มี 8 คอลัมน์ — เนื้อหา 250px ทำให้ผลรวมเกินกล่องตาราง (1036px ที่ 1280) จึงเหลือ 126 (+ pr-6 = 150)
      // เผื่อข้อมูลจริงที่กว้างที่สุด (paid + ยอดหลักแสน + period/paid at วันที่สองหลัก) ให้ผลรวมความกว้างขั้นต่ำยังไม่เกิน 1036px
      // กฎ 49 (ADM-45): จอ ≥ 1536 (`2xl`) เนื้อหา 250px — td ได้ width จาก `size` เป็นค่าตั้งต้น (คอลัมน์ไม่ใช่ auto จึงไม่รับส่วนเกินตามกฎ 41c)
      // แล้วขยายตามความกว้างของ div ห่อด้านใน (ไม่มี maxSize — ถ้ามี td ถูกกดเหลือ 150 ทุกจอ); div ห่อไม่ตัด overflow เอง
      // ข้อความจึงยังล้นไปถึง div `.truncate` ของ TruncatedCell → tooltip ชื่อเต็มเหมือนเดิม (กฎ 41b)
      columnHelper.accessor("affiliate_id", {
        header: "Affiliate",
        size: 150,
        cell: ({ row }) => (
          <div className="w-[126px] 2xl:w-[250px]">
            <AffiliateCell row={row.original} />
          </div>
        ),
      }),
      // spec 08 กฎ 45 (ADM-41): Amount/Period/Paid at เป็นคอลัมน์ auto (`size: undefined` — ไม่งั้นได้ width 150 ค่าเริ่มต้นของ tanstack)
      // รับความกว้างส่วนเกินที่จอกว้างแทนคอลัมน์ Payout (กฎ 41c) — ข้อความสั้นไม่ถูกตัด; ถ้าทุกคอลัมน์มี width Chrome แจกส่วนเกิน
      // ตามสัดส่วนโดยไม่สน maxSize ของคอลัมน์ข้อความ
      columnHelper.accessor((row) => getLocaleAmount(castNumber(row.amount), row.currency), {
        id: "amount",
        header: "Amount",
        size: undefined,
      }),
      columnHelper.accessor(
        (row) => `${getFullDate({ date: row.period_from })} – ${getFullDate({ date: row.period_to })}`,
        { id: "period", header: "Period", size: undefined },
      ),
      columnHelper.accessor("paid_at", {
        header: "Paid at",
        size: undefined,
        cell: ({ getValue }) => {
          const value = getValue()
          return value ? getFullDate({ date: value, includeTime: true }) : "-"
        },
      }),
      // spec 08 กฎ 39 (ADM-35): DataTable เป็น auto layout + nowrap คอลัมน์จึงขยายตามข้อความจนปุ่ม … หลุดจอ — จำกัดด้วย size/maxSize
      // (width/max-width ของ td แบบ border-box จึงบวก padding pr-6) ข้อความที่ถูกตัดยังมี tooltip ของ TruncatedCell;
      // กฎ 45 (ADM-41): เนื้อหา 100px (+ pr-6 = 124) แทน 250px ของกฎ 39 ให้ทั้งตารางไม่ล้นที่ 1280
      columnHelper.accessor("reference", {
        header: "Reference",
        size: 124,
        maxSize: 124,
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      // spec 08 กฎ 45 (ADM-41): id (`affpay_` + ULID ~250px) ถูกตัดที่เนื้อหา 100px (+ pr-6 = 124) พร้อม tooltip id เต็มของ TruncatedCell
      // — ไม่เป็นคอลัมน์ auto ตามกฎ 41c แล้ว (คอลัมน์ auto กว้างไม่น้อยกว่าข้อความ → ตารางล้นที่ 1280); Amount/Period/Paid at รับส่วนเกินแทน
      columnHelper.accessor("id", { header: "Payout", size: 124, maxSize: 124 }),
    ],
    [actionsColumn, getFullDate],
  )

  return (
    <>
      {/* spec 08 กฎ 18: `action` ของ DataTable ใส่ data-testid ไม่ได้ — e2e หาปุ่มด้วย role + ชื่อภายใน wrapper นี้ */}
      <div data-testid="affiliate-payouts-table">
        <AffiliateListTable
          {...list}
          rows={rows}
          columns={columns}
          heading="Payouts"
          subHeading="Draft payouts can be marked paid or cancelled."
          action={{ label: "Create payout", onClick: () => setCreating((c) => c ?? Date.now()) }}
          empty="No payouts yet"
        />
      </div>
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
