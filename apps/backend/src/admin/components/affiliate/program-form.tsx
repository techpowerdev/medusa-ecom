import { Combobox, Form, KeyboundForm } from "@medusajs/dashboard/components"
import { useComboboxData } from "@medusajs/dashboard/hooks"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, DatePicker, FocusModal, Heading, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { sdk } from "../../lib/client"
import { affiliateKeys, createProgram, Program, ProgramBody, updateProgram } from "../../lib/affiliate"
import {
  allowedProgramStatuses,
  emptyProgramForm,
  omitUnchangedDates,
  PROGRAM_PARSE_OPTIONS,
  ProgramForm,
  programFormSchema,
  programToForm,
  toProgramBody,
} from "../../lib/affiliate-program-form"
import { createSingleFlight } from "../../lib/single-flight"
import { NumberInput } from "../common/number-input"

// spec 08 กฎ 5: กรอกตาม timezone ของเครื่องแอดมิน (ต้องตั้งเป็นเวลาไทย) — ส่ง Date เข้า API ตรงๆ
const DATES: { key: "starts_at" | "ends_at"; label: string }[] = [
  { key: "starts_at", label: "Starts at *" },
  { key: "ends_at", label: "Ends at *" },
]

const NUMBERS: { key: "commission_value" | "attribution_window_days" | "hold_days" | "cap_per_order"; label: string }[] = [
  { key: "commission_value", label: "Commission (%) *" },
  { key: "attribution_window_days", label: "Attribution window (days) *" },
  { key: "hold_days", label: "Hold days *" },
  { key: "cap_per_order", label: "Cap per order (THB)" },
]

const idsOrUndefined = (ids?: string[]) => (ids?.length ? ids : undefined)

// spec 08 กฎ 11: scope ค้นหาฝั่ง server + แบ่งหน้าด้วย useComboboxData (route ของ Medusa ตามเดิม ไม่สร้างใหม่) — mount เมื่อปิด all เท่านั้น
const ScopeFields = ({ form, program }: { form: UseFormReturn<ProgramForm>; program?: Program }) => {
  const collections = useComboboxData({
    queryKey: ["affiliate-program-scope", "collections"],
    queryFn: (params) => sdk.admin.productCollection.list({ ...params, fields: "id,title" }),
    getOptions: (data) => data.collections.map((c) => ({ label: c.title, value: c.id })),
    defaultValue: idsOrUndefined(program?.scope?.collection_ids),
  })
  const categories = useComboboxData({
    queryKey: ["affiliate-program-scope", "categories"],
    queryFn: (params) => sdk.admin.productCategory.list({ ...params, fields: "id,name" }),
    getOptions: (data) => data.product_categories.map((c) => ({ label: c.name, value: c.id })),
    defaultValue: idsOrUndefined(program?.scope?.category_ids),
  })
  const fields = [
    { key: "collection_ids", label: "Collections", data: collections },
    { key: "category_ids", label: "Categories", data: categories },
  ] as const

  return (
    <>
      {fields.map(({ key, label, data }) => (
        <Form.Field
          key={key}
          control={form.control}
          name={key}
          render={({ field: { onChange, ...field } }) => (
            <Form.Item>
              <Form.Label>{label}</Form.Label>
              <Form.Control>
                <Combobox
                  {...field}
                  onChange={(ids?: string | string[]) => {
                    // error "ต้องเลือกอย่างน้อยหนึ่ง" ผูกกับ collection_ids — การเลือกช่องใดก็ตามล้างได้
                    form.clearErrors("collection_ids")
                    onChange(ids ?? [])
                  }}
                  options={data.options}
                  searchValue={data.searchValue}
                  onSearchValueChange={data.onSearchValueChange}
                  fetchNextPage={data.fetchNextPage}
                  isFetchingNextPage={data.isFetchingNextPage}
                  data-testid={`affiliate-program-field-${key}`}
                />
              </Form.Control>
              <Form.ErrorMessage data-testid={`affiliate-program-error-${key}`} />
            </Form.Item>
          )}
        />
      ))}
    </>
  )
}

/**
 * AF-12a (กฎ 37a): FocusModal สร้าง (program = undefined) หรือแก้โปรแกรม — ส่ง scope ทั้งก้อนโดยคง variant_ids เดิม (Q16)
 * เปิดเมื่อ `open`; component ถูก mount ใหม่ต่อการเปิดแต่ละครั้ง (key) จึงตั้งค่าฟอร์มเริ่มจาก props ได้เลย
 * ADM-9 (spec 08 AC-12, กฎ 8): Form + KeyboundForm ของ dashboard + zod (⌘/Ctrl+Enter ส่งได้); กฎธุรกิจยังอยู่ใน toProgramBody → form.setError
 */
export const ProgramFormModal = ({ program, onClose }: { program?: Program; onClose: () => void }) => {
  const queryClient = useQueryClient()
  // resolver คืนค่าดิบ (raw) แบบ ADM-3/ADM-7 — schema ไม่มี transform จึงใช้ values ได้เลย
  const form = useForm<ProgramForm>({
    resolver: zodResolver(programFormSchema, PROGRAM_PARSE_OPTIONS, { raw: true }),
    defaultValues: program ? programToForm(program) : emptyProgramForm(),
  })
  const [submitOnce] = useState(createSingleFlight)
  const all = form.watch("all")
  const variantCount = form.watch("variant_ids").length

  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("programs") })

  const save = useMutation({
    mutationFn: (body: ProgramBody) =>
      program ? updateProgram(program.id, omitUnchangedDates(body, program)) : createProgram(body),
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

  const handleSubmit = form.handleSubmit((values) =>
    submitOnce(async () => {
      const result = toProgramBody(values)
      if ("error" in result) {
        form.setError(result.field, { message: result.error })
        return
      }
      await save.mutateAsync(result.body).catch(() => undefined)
    })
  )

  return (
    <FocusModal open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <FocusModal.Content>
        <Form {...form}>
          {/* noValidate: validation เป็นของ zod/toProgramBody (error ใต้ช่อง) ไม่ให้ browser ดัก input number ก่อน */}
          <KeyboundForm noValidate onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  size="small"
                  type="submit"
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
                <Form.Field
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <Form.Item>
                      <Form.Label>Name *</Form.Label>
                      <Form.Control>
                        <Input {...field} size="small" data-testid="affiliate-program-field-name" />
                      </Form.Control>
                      <Form.ErrorMessage data-testid="affiliate-program-error-name" />
                    </Form.Item>
                  )}
                />
                {DATES.map(({ key, label }) => (
                  <Form.Field
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>{label}</Form.Label>
                        {/* e2e กรอกผ่าน wrapper ที่มี testid เดิม (fillDatePicker — spec 08 กฎ 7b) */}
                        <div data-testid={`affiliate-program-field-${key}`}>
                          <Form.Control>
                            <DatePicker {...field} granularity="minute" shouldCloseOnSelect={false} />
                          </Form.Control>
                        </div>
                        <Form.ErrorMessage data-testid={`affiliate-program-error-${key}`} />
                      </Form.Item>
                    )}
                  />
                ))}
                {NUMBERS.map(({ key, label }) => (
                  <Form.Field
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>{label}</Form.Label>
                        <Form.Control>
                          <NumberInput {...field} size="small" data-testid={`affiliate-program-field-${key}`} />
                        </Form.Control>
                        <Form.ErrorMessage data-testid={`affiliate-program-error-${key}`} />
                      </Form.Item>
                    )}
                  />
                ))}
                <Form.Field
                  control={form.control}
                  name="announce_text"
                  render={({ field }) => (
                    <Form.Item>
                      <Form.Label>Announcement</Form.Label>
                      <Form.Control>
                        <Textarea {...field} data-testid="affiliate-program-field-announce_text" />
                      </Form.Control>
                    </Form.Item>
                  )}
                />
                <Form.Field
                  control={form.control}
                  name="status"
                  render={({ field: { onChange, ref, ...field } }) => (
                    <Form.Item>
                      <Form.Label>Status *</Form.Label>
                      {/* กฎ 20: แสดงเฉพาะสถานะที่เปลี่ยนไปได้จากสถานะปัจจุบัน */}
                      <Form.Control>
                        <Select {...field} size="small" onValueChange={onChange}>
                          <Select.Trigger ref={ref} data-testid="affiliate-program-field-status">
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
                      </Form.Control>
                    </Form.Item>
                  )}
                />
                <Form.Field
                  control={form.control}
                  name="all"
                  render={({ field: { value, onChange, ...field } }) => (
                    <Form.Item className="flex-row items-center gap-x-2 space-y-0">
                      <Form.Control>
                        <Switch
                          {...field}
                          checked={value}
                          onCheckedChange={(checked) => {
                            form.clearErrors("collection_ids")
                            onChange(checked)
                          }}
                          data-testid="affiliate-program-scope-all"
                        />
                      </Form.Control>
                      <Form.Label>All products</Form.Label>
                    </Form.Item>
                  )}
                />
                {!all && <ScopeFields form={form} program={program} />}
                {/* Q16: variant_ids แก้ใน UI ไม่ได้ใน v1 — แสดงจำนวนและส่งค่าเดิมกลับเสมอ */}
                <Text size="xsmall" className="text-ui-fg-subtle" data-testid="affiliate-program-variant-count">
                  Variants set via API: {variantCount} (kept as is; edit through the API)
                </Text>
              </div>
            </FocusModal.Body>
          </KeyboundForm>
        </Form>
      </FocusModal.Content>
    </FocusModal>
  )
}
