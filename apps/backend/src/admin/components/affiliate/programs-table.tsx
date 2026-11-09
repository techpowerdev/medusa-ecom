import { ActionMenu } from "@medusajs/dashboard/components"
import { useDate } from "@medusajs/dashboard/hooks"
import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import { Badge, createDataTableColumnHelper, IconButton, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useReducer, useState } from "react"
import { affiliateKeys, deleteProgram, Program } from "../../lib/affiliate"
import { canDeleteProgram } from "../../lib/affiliate-program-form"
import { createSingleFlight } from "../../lib/single-flight"
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
  // เปิด modal/drawer จาก menuitem: mount เมนูใหม่ใน commit เดียวกัน (ปิดทันทีไม่รอ animation) — ไม่งั้น Radix คนละสำเนา
  // ของเมนูกับ modal คืนค่า pointer-events ของ body สลับกันจนหน้าเป็น `none` ค้างหลังปิด modal (คลิกอะไรไม่ได้)
  const [menuKey, remountMenu] = useReducer((k: number) => k + 1, 0)

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
      <IconButton size="small" variant="transparent" data-testid="affiliate-program-row-actions">
        <EllipsisHorizontal />
      </IconButton>
    </ActionMenu>
  )
}

// AF-12a (spec 05 กฎ 37a): แท็บ Programs — สร้าง/แก้ (FocusModal) และลบเฉพาะ draft (usePrompt) ผ่าน admin API ของ AF-5
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
        cell: ({ row }) => (
          <ProgramActions row={row.original} onEdit={(p) => setModal({ program: p, opened: Date.now() })} />
        ),
      }),
    [],
  )

  const columns = useMemo(
    () => [
      program.accessor("name", { header: "Program" }),
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
      program.accessor("hold_days", { header: "Hold days" }),
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
