import { ActionMenu } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, IconButton, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { affiliateKeys, deleteProgram, Program } from "../../lib/affiliate"
import { canDeleteProgram } from "../../lib/affiliate-program-form"
import { createSingleFlight } from "../../lib/single-flight"
import { useRemountMenu } from "../common/use-remount-menu"
import { AffiliateListTable, useAffiliateList } from "./list-table"
import { ProgramFormModal } from "./program-form"

const program = createDataTableColumnHelper<Program>()

/**
 * ADM-8b (spec 08 AC-13, กฎ 4, 10): Edit/Delete ต่อแถวใน ActionMenu — ถือ prompt/mutation ลบของแถวเอง (แบบ `*Actions` ของ dashboard)
 * modal แก้อยู่นอกตาราง (render ใน cell แล้ว Escape ครั้งแรกไม่ปิด modal)
 */
const ProgramActions = ({ row, onEdit }: { row: Program; onEdit: (p: Program) => void }) => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  const [deleteOnce] = useState(createSingleFlight)
  // เปิด Drawer จาก menuitem: remount เมนู + focus ปุ่ม … ตัวใหม่ให้ Drawer จำเป็น opener (qa #499 O-1, spec 08 กฎ 38/51)
  const { menuKey, remountMenu, trigger } = useRemountMenu()

  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("programs") })
  const remove = useMutation({
    mutationFn: deleteProgram,
    onSuccess: () => {
      toast.success("Program deleted")
      return refetch()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })

  // กล่องยืนยันเปิดอยู่หรือ request ยังไม่จบ → กด menuitem ซ้ำถูกข้าม
  const confirmDelete = () =>
    deleteOnce(async () => {
      const ok = await prompt({
        title: `Delete ${row.name}?`,
        description: "Only draft programs can be deleted. This cannot be undone.",
        confirmText: "Delete program",
        cancelText: "Keep program",
      })
      if (ok) {
        await remove.mutateAsync(row.id).catch(() => undefined)
      }
    })

  return (
    <ActionMenu
      key={menuKey}
      groups={[
        {
          actions: [
            {
              label: "Edit",
              icon: <PencilSquare />,
              // ระหว่าง Delete กำลังส่ง แก้ไม่ได้ (สอดคล้องกับแถว payout — review #316)
              disabled: remove.isPending,
              onClick: () => {
                remountMenu()
                onEdit(row)
              },
            },
          ],
        },
        // ลบได้เฉพาะ draft — สถานะอื่นไม่มี menuitem Delete (spec 08 กฎ 10)
        ...(canDeleteProgram(row)
          ? [{ actions: [{ label: "Delete", icon: <Trash />, disabled: remove.isPending, onClick: confirmDelete }] }]
          : []),
      ]}
    >
      <IconButton ref={trigger} size="small" variant="transparent" data-testid="affiliate-program-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// AF-12a (spec 05 กฎ 37a): แท็บ Programs — สร้าง (FocusModal)/แก้ (Drawer — ADM-44) และลบเฉพาะ draft (usePrompt) ผ่าน admin API ของ AF-5
export const ProgramsTable = () => {
  const { getFullDate } = useDate()
  const list = useAffiliateList<Program>("programs", "programs")
  // modal: undefined = ปิด, null = สร้าง, Program = แก้; `opened` เป็น key ให้ฟอร์ม mount ใหม่ทุกครั้งที่เปิด
  const [modal, setModal] = useState<{ program: Program | null; opened: number }>()

  // `cell` ต้องคงที่ข้าม render: สร้างใหม่ = React mount แถวใหม่และเมนูที่เปิดอยู่ปิดเองตอน refetch
  // (usePrompt/useDate คืนฟังก์ชันใหม่ทุก render จึงไม่อยู่ใน deps ของคอลัมน์นี้ — nit #163)
  const actionsColumn = useMemo(
    () =>
      program.display({
        id: "actions",
        // spec 08 กฎ 37: ไม่ห่อด้วย tooltip ของ TruncatedCell — tooltip ที่เปิดเมื่อ focus กลับมาที่ trigger กิน Escape แรกของ ActionMenu
        meta: { ___truncateTooltip: false },
        cell: ({ row }) => (
          <ProgramActions row={row.original} onEdit={(p) => setModal({ program: p, opened: Date.now() })} />
        ),
      }),
    [],
  )

  const columns = useMemo(
    () => [
      // spec 08 กฎ 39 (ADM-35): เนื้อหา 250px (แบบ ProductCell ของ dashboard) — DataTable เป็น auto layout + nowrap คอลัมน์จึงขยายตามข้อความ
      // จนปุ่ม … หลุดจอ; size/maxSize เป็น width/max-width ของ td (border-box) จึงบวก padding: คอลัมน์แรก pl-6+pr-6 = 298, คอลัมน์อื่น pr-6 = 274
      // ข้อความที่ถูกตัดยังมี tooltip ของ TruncatedCell
      program.accessor("name", { header: "Program", size: 298, maxSize: 298 }),
      program.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
      }),
      actionsColumn,
      program.accessor("starts_at", {
        header: "Starts",
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
      program.accessor("ends_at", {
        header: "Ends",
        cell: ({ getValue }) => getFullDate({ date: getValue(), includeTime: true }),
      }),
      program.accessor((row) => `${row.commission_value}%`, {
        id: "rate",
        header: "Commission",
      }),
      // spec 08 กฎ 41c (ADM-37, Q12 = ก): คอลัมน์สุดท้ายเป็น auto (ไม่มี width) รับความกว้างส่วนเกินที่จอกว้าง — ไม่งั้นทุก td ได้ width 150
      // (ค่าเริ่มต้นของ tanstack) ผลรวมน้อยกว่าตาราง w-full แล้ว Chrome แจกส่วนเกินตามสัดส่วนโดยไม่สน maxSize ของคอลัมน์ข้อความ
      program.accessor("hold_days", { header: "Hold days", size: undefined }),
    ],
    [actionsColumn, getFullDate],
  )

  return (
    <>
      {/* spec 08 กฎ 18: `action` ของ DataTable ใส่ data-testid ไม่ได้ — e2e หาปุ่มด้วย role + ชื่อภายใน wrapper นี้ */}
      <div data-testid="affiliate-programs-table">
        <AffiliateListTable
          {...list}
          columns={columns}
          heading="Programs"
          subHeading="Only draft programs can be deleted."
          // กดซ้ำขณะ modal เปิดอยู่ไม่เปลี่ยน `opened` (ฟอร์มไม่ mount ใหม่)
          action={{ label: "Create program", onClick: () => setModal((m) => m ?? { program: null, opened: Date.now() }) }}
          empty="No programs yet"
        />
      </div>
      {modal && (
        <ProgramFormModal
          key={modal.opened}
          program={modal.program ?? undefined}
          onClose={() => setModal(undefined)}
        />
      )}
    </>
  )
}
