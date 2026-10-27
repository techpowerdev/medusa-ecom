import {
  Button,
  Container,
  Drawer,
  FocusModal,
  Heading,
  Input,
  Label,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { evoucherApi, evoucherKeys, Partner, PartnerInput } from "../../lib/evoucher"
import { createSingleFlight } from "../../lib/single-flight"

const FIELDS: { key: keyof PartnerInput; label: string }[] = [
  { key: "name", label: "Name *" },
  { key: "logo_url", label: "Logo URL" },
  { key: "terms_url", label: "Terms URL" },
  { key: "support_contact", label: "Support contact" },
]

const toForm = (p?: Partner): Record<keyof PartnerInput, string> => ({
  name: p?.name ?? "",
  logo_url: p?.logo_url ?? "",
  terms_url: p?.terms_url ?? "",
  support_contact: p?.support_contact ?? "",
})

// ค่าว่าง → null เพื่อให้ล้างค่าเดิมได้ (validator รับ nullish)
const toBody = (form: Record<keyof PartnerInput, string>): PartnerInput => ({
  name: form.name.trim(),
  logo_url: form.logo_url.trim() || null,
  terms_url: form.terms_url.trim() || null,
  support_contact: form.support_contact.trim() || null,
})

const PartnerFields = ({
  form,
  onChange,
}: {
  form: Record<keyof PartnerInput, string>
  onChange: (form: Record<keyof PartnerInput, string>) => void
}) => {
  // กฎข้อ 11: Label ผูก htmlFor กับ id ของ input (useId กัน id ซ้ำระหว่าง modal สร้างกับ drawer แก้ไข)
  const prefix = useId()
  return (
    <div className="flex flex-col gap-y-4">
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-y-2">
          <Label size="small" htmlFor={`${prefix}-${key}`}>
            {label}
          </Label>
          <Input
            id={`${prefix}-${key}`}
            size="small"
            value={form[key]}
            onChange={(e) => onChange({ ...form, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  )
}

export const PartnersSection = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [form, setForm] = useState(toForm())
  const [submitOnce] = useState(createSingleFlight)

  const { data, isLoading } = useQuery({
    queryKey: evoucherKeys.partners,
    queryFn: evoucherApi.listPartners,
  })

  const onSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: evoucherKeys.partners })
    queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
    toast.success(message)
    setCreateOpen(false)
    setEditing(null)
  }
  const onError = (e: Error) => toast.error(e.message)

  const save = useMutation({
    mutationFn: () =>
      editing
        ? evoucherApi.updatePartner(editing.id, toBody(form))
        : evoucherApi.createPartner(toBody(form)),
    onSuccess: () => onSuccess(editing ? "Partner updated" : "Partner created"),
    onError,
  })
  const remove = useMutation({
    mutationFn: (id: string) => evoucherApi.deletePartner(id),
    onSuccess: () => onSuccess("Partner deleted"),
    onError,
  })

  const openCreate = () => {
    setForm(toForm())
    setCreateOpen(true)
  }
  const openEdit = (partner: Partner) => {
    setForm(toForm(partner))
    setEditing(partner)
  }
  const confirmDelete = async (partner: Partner) => {
    const ok = await prompt({
      title: `Delete ${partner.name}?`,
      description: "Partners that still have pools cannot be deleted.",
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (ok) {
      remove.mutate(partner.id)
    }
  }
  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    // กฎข้อ 11: กันคลิกซ้อนก่อน isPending เป็น true; error แสดงผ่าน onError แล้ว
    submitOnce(() => save.mutateAsync().catch(() => undefined))
  }

  const saveButton = (
    <Button size="small" onClick={submit} disabled={save.isPending} isLoading={save.isPending}>
      Save
    </Button>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Partners</Heading>
        <Button size="small" variant="secondary" onClick={openCreate}>
          Create partner
        </Button>
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {isLoading ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Loading…
          </Text>
        ) : !data?.partners.length ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            No partners yet
          </Text>
        ) : (
          data.partners.map((partner) => (
            <div key={partner.id} className="flex items-center justify-between gap-x-3">
              <div className="flex flex-col">
                <Text size="small" leading="compact" weight="plus">
                  {partner.name}
                </Text>
                <Text size="small" leading="compact" className="text-ui-fg-subtle">
                  {partner.support_contact ?? "-"}
                </Text>
              </div>
              <div className="flex gap-x-2">
                <Button size="small" variant="secondary" onClick={() => openEdit(partner)}>
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => confirmDelete(partner)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <FocusModal open={createOpen} onOpenChange={setCreateOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">{saveButton}</div>
          </FocusModal.Header>
          <FocusModal.Body className="flex justify-center overflow-auto py-16">
            <div className="flex w-full max-w-lg flex-col gap-y-6">
              <Heading>Create partner</Heading>
              <PartnerFields form={form} onChange={setForm} />
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      <Drawer open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Edit partner</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="overflow-auto p-4">
            <PartnerFields form={form} onChange={setForm} />
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button size="small" variant="secondary" disabled={save.isPending}>
                Cancel
              </Button>
            </Drawer.Close>
            {saveButton}
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}
