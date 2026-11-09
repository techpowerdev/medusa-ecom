import { ActionMenu, DataTable, Form, KeyboundForm, NoRecords } from "@medusajs/dashboard/components"
import { zodResolver } from "@hookform/resolvers/zod"
import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import {
  Button,
  createDataTableColumnHelper,
  Drawer,
  FocusModal,
  Heading,
  IconButton,
  Input,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { evoucherApi, evoucherKeys, Partner, PartnerInput } from "../../lib/evoucher"
import {
  PARTNER_PARSE_OPTIONS,
  partnerFormSchema,
  type PartnerFormValues,
  toPartnerFormValues,
} from "../../lib/evoucher-partner-form"
import { createSingleFlight } from "../../lib/single-flight"
import { Container } from "../common/container"
import { usePageOffset } from "../common/use-page-offset"

const columnHelper = createDataTableColumnHelper<Partner>()
const PAGE_SIZE = 20
// spec 08 กฎ 9: prefix ไม่ซ้ำกับตาราง pools ในหน้าเดียวกัน — หน้าปัจจุบันอยู่ใน URL (`partners_offset`)
const PREFIX = "partners"

const FIELDS: { name: keyof PartnerFormValues; label: string }[] = [
  { name: "name", label: "Name *" },
  { name: "logo_url", label: "Logo URL" },
  { name: "terms_url", label: "Terms URL" },
  { name: "support_contact", label: "Support contact" },
]

const PartnerFields = () => (
  <div className="flex flex-col gap-y-4">
    {FIELDS.map(({ name, label }) => (
      <Form.Field
        key={name}
        name={name}
        render={({ field }) => (
          <Form.Item>
            <Form.Label>{label}</Form.Label>
            <Form.Control>
              <Input {...field} size="small" />
            </Form.Control>
            <Form.ErrorMessage data-testid={`evoucher-partner-${name}-error`} />
          </Form.Item>
        )}
      />
    ))}
  </div>
)

// EV-6: พาร์ทเนอร์ของ e-voucher — ADM-5: DataTable ของ dashboard (แบ่งหน้าใน URL), Edit/Delete ใน ActionMenu,
// ฟอร์มเป็น Form + zod (สร้าง = FocusModal, แก้ = Drawer แบบ state — ADR-018 Q5)
export const PartnersSection = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้วแปลงเป็น body ด้วย schema เดียวกันตอน submit (แบบ ADM-3)
  const form = useForm({
    resolver: zodResolver(partnerFormSchema, PARTNER_PARSE_OPTIONS, { raw: true }),
    defaultValues: toPartnerFormValues(),
  })
  // spec 02 กฎข้อ 11 / spec 08 กฎ 4: dblclick / ⌘+Enter ซ้ำก่อน isPending เป็น true → request ครั้งเดียว
  const [submitOnce] = useState(createSingleFlight)
  const [deleteOnce] = useState(createSingleFlight)

  const [count, setCount] = useState<number>()
  const offset = usePageOffset(PREFIX, PAGE_SIZE, { count })
  const query = { limit: PAGE_SIZE, offset }
  const { data, isLoading } = useQuery({
    queryKey: [...evoucherKeys.partners, query],
    queryFn: () => evoucherApi.listPartners(query),
    placeholderData: keepPreviousData,
  })
  useEffect(() => setCount(data?.count), [data?.count])

  const onSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: evoucherKeys.partners })
    queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
    toast.success(message)
    setCreateOpen(false)
    setEditing(null)
  }
  const onError = (e: Error) => toast.error(e.message)

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: PartnerInput }) =>
      id ? evoucherApi.updatePartner(id, body) : evoucherApi.createPartner(body),
    onSuccess: (_, { id }) => onSuccess(id ? "Partner updated" : "Partner created"),
    onError,
  })
  const remove = useMutation({
    mutationFn: (id: string) => evoucherApi.deletePartner(id),
    onSuccess: () => onSuccess("Partner deleted"),
    onError,
  })

  // กดซ้ำขณะ modal เปิดอยู่ไม่ล้างค่าที่กรอกไว้ (spec 08 กฎ 18)
  const openCreate = () => {
    if (createOpen) return
    form.reset(toPartnerFormValues())
    setCreateOpen(true)
  }

  const { mutateAsync: removePartner, isPending: removing } = remove
  const columns = useMemo(() => {
    const openEdit = (partner: Partner) => {
      form.reset(toPartnerFormValues(partner))
      setEditing(partner)
    }
    // guard ครอบทั้ง prompt + request — กด Delete ซ้ำระหว่างรอ prompt/request ไม่ยิงซ้ำ
    const confirmDelete = (partner: Partner) =>
      deleteOnce(async () => {
        const ok = await prompt({
          title: `Delete ${partner.name}?`,
          description: "Partners that still have pools cannot be deleted.",
          confirmText: "Delete",
          cancelText: "Cancel",
        })
        if (ok) {
          await removePartner(partner.id).catch(() => undefined)
        }
      })

    return [
      columnHelper.accessor("name", { header: "Name" }),
      columnHelper.accessor("support_contact", {
        header: "Support contact",
        cell: ({ getValue }) => getValue() ?? "-",
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <ActionMenu
            groups={[
              {
                actions: [
                  { label: "Edit", icon: <PencilSquare />, onClick: () => openEdit(row.original) },
                  {
                    label: "Delete",
                    icon: <Trash />,
                    disabled: removing,
                    onClick: () => confirmDelete(row.original),
                  },
                ],
              },
            ]}
          >
            <IconButton size="small" variant="transparent" data-testid="evoucher-partner-row-actions">
              <EllipsisHorizontal />
            </IconButton>
          </ActionMenu>
        ),
      }),
    ]
  }, [form, prompt, deleteOnce, removePartner, removing])

  const submit = form.handleSubmit((values) =>
    submitOnce(() =>
      save
        .mutateAsync({ id: editing?.id, body: partnerFormSchema.parse(values, PARTNER_PARSE_OPTIONS) })
        .catch(() => undefined)
    )
  )

  const saveButton = (
    <Button size="small" type="submit" disabled={save.isPending} isLoading={save.isPending}>
      Save
    </Button>
  )

  return (
    <Container data-testid="evoucher-partners">
      {/* spec 08 กฎ 18: `action` ของ DataTable ใส่ data-testid ไม่ได้ — e2e หาปุ่มด้วย role + ชื่อภายใน wrapper นี้ */}
      <div data-testid="evoucher-partners-table">
        <DataTable
          data={data?.partners ?? []}
          columns={columns}
          getRowId={(partner) => partner.id}
          rowCount={data?.count ?? 0}
          isLoading={isLoading}
          heading="Partners"
          headingLevel="h2"
          action={{ label: "Create partner", onClick: openCreate }}
          prefix={PREFIX}
          pageSize={PAGE_SIZE}
          enableSearch={false}
          emptyState={{
            empty:
              data?.count === 0
                ? {
                    custom: (
                      <div data-testid="evoucher-partners-empty">
                        <NoRecords title="No partners yet" message="Create a partner before creating voucher pools." />
                      </div>
                    ),
                  }
                : { heading: "No partners on this page" },
          }}
        />
      </div>

      <FocusModal open={createOpen} onOpenChange={setCreateOpen}>
        <FocusModal.Content>
          {/* noValidate: validation ทั้งหมดเป็นของ zod (error ใต้ช่อง) */}
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={submit} className="flex h-full flex-col overflow-hidden">
              <FocusModal.Header>
                <div className="flex items-center justify-end gap-x-2">{saveButton}</div>
              </FocusModal.Header>
              <FocusModal.Body className="flex flex-1 justify-center overflow-auto py-16">
                <div className="flex w-full max-w-lg flex-col gap-y-6">
                  <Heading>Create partner</Heading>
                  <PartnerFields />
                </div>
              </FocusModal.Body>
            </KeyboundForm>
          </Form>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <Drawer.Content>
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
              <Drawer.Header>
                <Drawer.Title>Edit partner</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex-1 overflow-auto p-4">
                <PartnerFields />
              </Drawer.Body>
              <Drawer.Footer>
                <div className="flex items-center justify-end gap-x-2">
                  <Drawer.Close asChild>
                    <Button size="small" variant="secondary" type="button" disabled={save.isPending}>
                      Cancel
                    </Button>
                  </Drawer.Close>
                  {saveButton}
                </div>
              </Drawer.Footer>
            </KeyboundForm>
          </Form>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
