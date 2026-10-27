import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { sdk } from "../../lib/client"
import { affiliateKeys, createProgram, Program, updateProgram } from "../../lib/affiliate"
import {
  allowedProgramStatuses,
  emptyProgramForm,
  ProgramForm,
  ProgramFormField,
  programToForm,
  toProgramBody,
} from "../../lib/affiliate-program-form"
import { createSingleFlight } from "../../lib/single-flight"

type TextField = Exclude<
  ProgramFormField,
  "status" | "all" | "collection_ids" | "category_ids" | "variant_ids" | "announce_text"
>

const INPUTS: { key: TextField; label: string; type?: string }[] = [
  { key: "name", label: "Name *" },
  { key: "starts_at", label: "Starts at (ICT) *", type: "datetime-local" },
  { key: "ends_at", label: "Ends at (ICT) *", type: "datetime-local" },
  { key: "commission_value", label: "Commission (%) *", type: "number" },
  { key: "attribution_window_days", label: "Attribution window (days) *", type: "number" },
  { key: "hold_days", label: "Hold days *", type: "number" },
  { key: "cap_per_order", label: "Cap per order (THB)", type: "number" },
]

// รายการ collection/category จาก admin API ของ Medusa (spec 05: ใช้ตามเดิม ไม่สร้าง route ใหม่)
const useScopeOptions = (enabled: boolean) => {
  const collections = useQuery({
    queryKey: ["affiliate-program-scope", "collections"],
    queryFn: () => sdk.admin.productCollection.list({ limit: 200, fields: "id,title" }),
    enabled,
  })
  const categories = useQuery({
    queryKey: ["affiliate-program-scope", "categories"],
    queryFn: () => sdk.admin.productCategory.list({ limit: 200, fields: "id,name" }),
    enabled,
  })
  return {
    collection_ids: (collections.data?.collections ?? []).map((c) => ({ id: c.id, label: c.title })),
    category_ids: (categories.data?.product_categories ?? []).map((c) => ({ id: c.id, label: c.name })),
  }
}

const ScopeList = ({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: { id: string; label: string }[]
  value: string[]
  onChange: (ids: string[]) => void
}) => {
  const prefix = useId()
  return (
    <div className="flex flex-col gap-y-2">
      <Label size="small">{title}</Label>
      {!options.length && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          None available
        </Text>
      )}
      {options.map(({ id, label }) => (
        <div key={id} className="flex items-center gap-x-2">
          <Checkbox
            id={`${prefix}-${id}`}
            checked={value.includes(id)}
            onCheckedChange={(checked) => onChange(checked ? [...value, id] : value.filter((v) => v !== id))}
          />
          <Label size="small" htmlFor={`${prefix}-${id}`}>
            {label}
          </Label>
        </div>
      ))}
    </div>
  )
}

/**
 * AF-12a (กฎ 37a): FocusModal สร้าง (program = undefined) หรือแก้โปรแกรม — ส่ง scope ทั้งก้อนโดยคง variant_ids เดิม (Q16)
 * เปิดเมื่อ `open`; component ถูก mount ใหม่ต่อการเปิดแต่ละครั้ง (key) จึงตั้งค่าฟอร์มเริ่มจาก props ได้เลย
 */
export const ProgramFormModal = ({ program, onClose }: { program?: Program; onClose: () => void }) => {
  const queryClient = useQueryClient()
  const prefix = useId()
  const [form, setForm] = useState<ProgramForm>(() => (program ? programToForm(program) : emptyProgramForm()))
  const [error, setError] = useState<{ field: ProgramFormField; message: string } | null>(null)
  const [submitOnce] = useState(createSingleFlight)
  const options = useScopeOptions(!form.all)

  const set = (patch: Partial<ProgramForm>) => {
    setError(null)
    setForm((f) => ({ ...f, ...patch }))
  }
  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("programs") })

  const save = useMutation({
    mutationFn: (body: Parameters<typeof createProgram>[0]) =>
      program ? updateProgram(program.id, body) : createProgram(body),
    onSuccess: () => {
      toast.success(program ? "Program updated" : "Program created")
      onClose()
      return refetch()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })

  const submit = () =>
    submitOnce(async () => {
      const result = toProgramBody(form)
      if ("error" in result) {
        setError({ field: result.field, message: result.error })
        return
      }
      await save.mutateAsync(result.body).catch(() => undefined)
    })

  const fieldError = (key: ProgramFormField) =>
    error?.field === key && (
      <Text size="xsmall" className="text-ui-fg-error" data-testid={`affiliate-program-error-${key}`}>
        {error.message}
      </Text>
    )

  return (
    <FocusModal open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center justify-end gap-x-2">
            <Button
              size="small"
              onClick={submit}
              isLoading={save.isPending}
              disabled={save.isPending}
              data-testid="affiliate-program-save"
            >
              Save
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex justify-center overflow-auto py-16">
          <div className="flex w-full max-w-lg flex-col gap-y-4">
            <Heading>{program ? "Edit program" : "Create program"}</Heading>
            {INPUTS.map(({ key, label, type }) => (
              <div key={key} className="flex flex-col gap-y-2">
                <Label size="small" htmlFor={`${prefix}-${key}`}>
                  {label}
                </Label>
                <Input
                  id={`${prefix}-${key}`}
                  size="small"
                  type={type ?? "text"}
                  value={form[key]}
                  onChange={(e) => set({ [key]: e.target.value })}
                  aria-invalid={error?.field === key}
                  data-testid={`affiliate-program-field-${key}`}
                />
                {fieldError(key)}
              </div>
            ))}
            <div className="flex flex-col gap-y-2">
              <Label size="small" htmlFor={`${prefix}-announce_text`}>
                Announcement
              </Label>
              <Textarea
                id={`${prefix}-announce_text`}
                value={form.announce_text}
                onChange={(e) => set({ announce_text: e.target.value })}
                data-testid="affiliate-program-field-announce_text"
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label size="small">Status *</Label>
              {/* กฎ 20: แสดงเฉพาะสถานะที่เปลี่ยนไปได้จากสถานะปัจจุบัน */}
              <Select
                size="small"
                value={form.status}
                onValueChange={(v) => set({ status: v as ProgramForm["status"] })}
              >
                <Select.Trigger data-testid="affiliate-program-field-status">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {allowedProgramStatuses(program?.status).map((s) => (
                    <Select.Item key={s} value={s}>
                      {s}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex items-center gap-x-2">
              <Switch
                id={`${prefix}-all`}
                checked={form.all}
                onCheckedChange={(all) => set({ all })}
                data-testid="affiliate-program-scope-all"
              />
              <Label size="small" htmlFor={`${prefix}-all`}>
                All products
              </Label>
            </div>
            {!form.all && (
              <>
                <ScopeList
                  title="Collections"
                  options={options.collection_ids}
                  value={form.collection_ids}
                  onChange={(collection_ids) => set({ collection_ids })}
                />
                <ScopeList
                  title="Categories"
                  options={options.category_ids}
                  value={form.category_ids}
                  onChange={(category_ids) => set({ category_ids })}
                />
              </>
            )}
            {/* Q16: variant_ids แก้ใน UI ไม่ได้ใน v1 — แสดงจำนวนและส่งค่าเดิมกลับเสมอ */}
            <Text size="xsmall" className="text-ui-fg-subtle" data-testid="affiliate-program-variant-count">
              Variants set via API: {form.variant_ids.length} (kept as is; edit through the API)
            </Text>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
