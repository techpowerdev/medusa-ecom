import { Badge, Button, createDataTableColumnHelper, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { affiliateKeys, deleteProgram, Program } from "../../lib/affiliate"
import { formatDate } from "../../lib/affiliate-format"
import { canDeleteProgram } from "../../lib/affiliate-program-form"
import { createSingleFlight } from "../../lib/single-flight"
import { AffiliateListTable } from "./list-table"
import { ProgramFormModal } from "./program-form"

const program = createDataTableColumnHelper<Program>()

// AF-12a (spec 05 กฎ 37a): แท็บ Programs — สร้าง/แก้ (FocusModal) และลบเฉพาะ draft (usePrompt) ผ่าน admin API ของ AF-5
export const ProgramsTable = () => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()
  // modal: undefined = ปิด, null = สร้าง, Program = แก้; `opened` เป็น key ให้ฟอร์ม mount ใหม่ทุกครั้งที่เปิด
  const [modal, setModal] = useState<{ program: Program | null; opened: number }>()
  const [deleteOnce] = useState(createSingleFlight)

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

  // กล่องยืนยันเปิดอยู่หรือ request ยังไม่จบ → คลิกซ้ำถูกข้าม
  const confirmDelete = (p: Program) =>
    deleteOnce(async () => {
      const ok = await prompt({
        title: `Delete ${p.name}?`,
        description: "Only draft programs can be deleted. This cannot be undone.",
        confirmText: "Delete program",
        cancelText: "Keep program",
      })
      if (ok) {
        await remove.mutateAsync(p.id).catch(() => undefined)
      }
    })

  const columns = useMemo(
    () => [
      program.accessor("name", { header: "Program" }),
      program.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => <Badge size="2xsmall">{getValue()}</Badge>,
      }),
      program.display({
        id: "actions",
        cell: ({ row }) => (
          <div className="flex gap-x-2">
            <Button
              size="small"
              variant="secondary"
              data-testid="affiliate-program-edit"
              onClick={() => setModal({ program: row.original, opened: Date.now() })}
            >
              Edit
            </Button>
            {canDeleteProgram(row.original) && (
              <Button
                size="small"
                variant="danger"
                data-testid="affiliate-program-delete"
                disabled={remove.isPending}
                onClick={() => confirmDelete(row.original)}
              >
                Delete
              </Button>
            )}
          </div>
        ),
      }),
      program.accessor("starts_at", {
        header: "Starts",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      program.accessor("ends_at", {
        header: "Ends",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      program.accessor((row) => `${row.commission_value}%`, {
        id: "rate",
        header: "Commission",
      }),
      program.accessor("hold_days", { header: "Hold days" }),
    ],
    // confirmDelete ใช้ prompt/mutateAsync/deleteOnce ที่ stable — สร้างคอลัมน์ใหม่เมื่อ isPending เปลี่ยน
    [remove.isPending],
  )

  return (
    <>
      <div className="flex justify-end px-6 py-4">
        <Button
          size="small"
          variant="secondary"
          data-testid="affiliate-program-create"
          onClick={() => setModal({ program: null, opened: Date.now() })}
        >
          Create program
        </Button>
      </div>
      <AffiliateListTable resource="programs" columns={columns} empty="No programs yet" />
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
