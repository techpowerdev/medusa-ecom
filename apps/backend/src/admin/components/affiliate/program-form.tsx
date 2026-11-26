import { Combobox, Form, KeyboundForm } from "@medusajs/dashboard/components"
import { useComboboxData } from "@medusajs/dashboard/hooks"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, DatePicker, Drawer, FocusModal, Heading, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, type FieldErrors, type Resolver, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import { useSingleFlight } from "../../lib/single-flight"
import { keepModalOpenWhileComboboxExpanded } from "../../lib/combobox-escape"
import { NumberInput } from "../common/number-input"
import { useConfirmDiscard } from "../common/use-confirm-discard"
import { useRestoreOpenerFocus } from "../common/use-restore-opener-focus"

// spec 08 กฎ 5: กรอกตาม timezone ของเครื่องแอดมิน (ต้องตั้งเป็นเวลาไทย) — ส่ง Date เข้า API ตรงๆ
// spec 10 (AI18N-4): label ของทุกช่อง = key `programForm.fields.<key>` แปลตอน render
const DATES = ["starts_at", "ends_at"] as const

const NUMBERS = ["commission_value", "attribution_window_days", "hold_days", "cap_per_order"] as const

const idsOrUndefined = (ids?: string[]) => (ids?.length ? ids : undefined)

// spec 08 กฎ 11: scope ค้นหาฝั่ง server + แบ่งหน้าด้วย useComboboxData (route ของ Medusa ตามเดิม ไม่สร้างใหม่) — mount เมื่อปิด all เท่านั้น
const ScopeFields = ({ form, program }: { form: UseFormReturn<ProgramForm>; program?: Program }) => {
  const { t } = useTranslation("ecom-affiliate")
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
    { key: "collection_ids", data: collections },
    { key: "category_ids", data: categories },
  ] as const

  return (
    <>
      {fields.map(({ key, data }) => (
        <Form.Field
          key={key}
          control={form.control}
          name={key}
          render={({ field: { onChange, ...field } }) => (
            <Form.Item>
              <Form.Label>{t(`programForm.fields.${key}`)}</Form.Label>
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

// ADM-44 (spec 08 กฎ 48a): resolver ตรวจทั้งรูปค่า (zod) และกฎธุรกิจ (toProgramBody) — Save แสดง error ทุกช่องพร้อมกัน (กฎ 46)
// และ RHF focus ช่องแรกที่ผิดเอง; หลัง Save ตรวจใหม่ตอนแก้ช่อง (reValidateMode) รวมช่องใน `deps` (ends_at เมื่อแก้ starts_at) ด้วยกฎเดียวกับตอน Save
const zodProgramResolver = zodResolver(programFormSchema, PROGRAM_PARSE_OPTIONS, { raw: true })
const programResolver: Resolver<ProgramForm> = async (values, context, options) => {
  const parsed = await zodProgramResolver(values, context, options)
  const result = toProgramBody(values)
  if (!("errors" in result) && !Object.keys(parsed.errors).length) {
    return parsed
  }
  const errors: FieldErrors<ProgramForm> = {}
  if ("errors" in result) {
    result.errors.forEach(({ field, message }) => (errors[field] ??= { type: "validate", message }))
  }
  return { values: {}, errors: { ...errors, ...parsed.errors } }
}

const ProgramFields = ({ form, program }: { form: UseFormReturn<ProgramForm>; program?: Program }) => {
  const { t } = useTranslation("ecom-affiliate")
  const all = form.watch("all")
  const variantCount = form.watch("variant_ids").length

  return (
    <>
      <Form.Field
        control={form.control}
        name="name"
        render={({ field }) => (
          <Form.Item>
            <Form.Label>{t("programForm.fields.name")}</Form.Label>
            <Form.Control>
              <Input {...field} size="small" data-testid="affiliate-program-field-name" />
            </Form.Control>
            <Form.ErrorMessage data-testid="affiliate-program-error-name" />
          </Form.Item>
        )}
      />
      {DATES.map((key) => (
        <Form.Field
          key={key}
          control={form.control}
          name={key}
          // กฎ 48a: ends_at ขึ้นกับ starts_at — หลังกด Save แก้ starts_at แล้ว RHF ตรวจ ends_at ใหม่ทันที (error ข้ามช่องไม่ค้าง)
          rules={key === "starts_at" ? { deps: ["ends_at"] } : undefined}
          render={({ field: { ref, ...field } }) => (
            <Form.Item>
              <Form.Label>{t(`programForm.fields.${key}`)}</Form.Label>
              {/* e2e กรอกผ่าน wrapper ที่มี testid เดิม (fillDatePicker — spec 08 กฎ 7b) */}
              <div data-testid={`affiliate-program-field-${key}`}>
                <Form.Control>
                  <DatePicker
                    {...field}
                    // กฎ 48c: ref ของ DatePicker เป็น div ที่ focus ไม่ได้ — ให้ RHF (shouldFocus) focus segment แรกแทน
                    ref={(el) => ref(el && { focus: () => el.querySelector<HTMLElement>('[role="spinbutton"]')?.focus() })}
                    granularity="minute"
                    shouldCloseOnSelect={false}
                  />
                </Form.Control>
              </div>
              <Form.ErrorMessage data-testid={`affiliate-program-error-${key}`} />
            </Form.Item>
          )}
        />
      ))}
      {NUMBERS.map((key) => (
        <Form.Field
          key={key}
          control={form.control}
          name={key}
          render={({ field }) => (
            <Form.Item>
              <Form.Label>{t(`programForm.fields.${key}`)}</Form.Label>
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
            <Form.Label>{t("programForm.fields.announce_text")}</Form.Label>
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
            <Form.Label>{t("programForm.fields.status")}</Form.Label>
            {/* กฎ 20: แสดงเฉพาะสถานะที่เปลี่ยนไปได้จากสถานะปัจจุบัน */}
            <Form.Control>
              <Select {...field} size="small" onValueChange={onChange}>
                <Select.Trigger ref={ref} data-testid="affiliate-program-field-status">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {allowedProgramStatuses(program?.status).map((s) => (
                    <Select.Item key={s} value={s}>
                      {t(`programs.status.${s}`, { defaultValue: s })}
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
            <Form.Label>{t("programForm.fields.all")}</Form.Label>
          </Form.Item>
        )}
      />
      {!all && <ScopeFields form={form} program={program} />}
      {/* Q16: variant_ids แก้ใน UI ไม่ได้ใน v1 — แสดงจำนวนและส่งค่าเดิมกลับเสมอ */}
      <Text size="xsmall" className="text-ui-fg-subtle" data-testid="affiliate-program-variant-count">
        {t("programForm.variantCount", { variantCount })}
      </Text>
    </>
  )
}

/**
 * AF-12a (กฎ 37a): สร้าง (program = undefined) ใน FocusModal หรือแก้โปรแกรมใน Drawer (ADM-44 กฎ 48b, ADR-018 Q5) — ส่ง scope ทั้งก้อนโดยคง variant_ids เดิม (Q16)
 * เปิดเมื่อ mount; component ถูก mount ใหม่ต่อการเปิดแต่ละครั้ง (key) จึงตั้งค่าฟอร์มเริ่มจาก props ได้เลย
 * ADM-9 (spec 08 AC-12, กฎ 8): Form + KeyboundForm ของ dashboard + zod (⌘/Ctrl+Enter ส่งได้); กฎธุรกิจของ toProgramBody อยู่ใน resolver (ADM-42/44)
 * ADM-26 (กฎ 30c): Escape ขณะ Combobox ของ scope ขยายไม่ปิด modal/Drawer (keepModalOpenWhileComboboxExpanded)
 */
export const ProgramFormModal = ({ program, onClose }: { program?: Program; onClose: () => void }) => {
  const { t } = useTranslation("ecom-affiliate")
  const queryClient = useQueryClient()
  const form = useForm<ProgramForm>({
    resolver: programResolver,
    defaultValues: program ? programToForm(program) : emptyProgramForm(),
  })
  // กฎ 43 (ADM-39): สำเร็จแล้ว hold lock จน component ถูกถอด (ปิด) — เปิดใหม่ mount ใหม่ (key) จึงได้ lock ใหม่ ไม่ต้อง release
  // กฎ 50 (ADM-46): `submitLocked` = in-flight หรือ hold — Save disabled จนถูกถอด
  const [submitOnce, submitLocked] = useSingleFlight()

  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("programs") })

  const save = useMutation({
    mutationFn: (body: ProgramBody) =>
      program ? updateProgram(program.id, omitUnchangedDates(body, program)) : createProgram(body),
    onSuccess: () => {
      toast.success(program ? t("programForm.updated") : t("programForm.created"))
      onClose()
      return refetch()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })

  // resolver ผ่านแล้ว = toProgramBody ไม่มี error (เช็กไว้เพื่อ narrow type)
  const handleSubmit = form.handleSubmit((values) =>
    submitOnce(async () => {
      const result = toProgramBody(values)
      if (!("errors" in result)) {
        await save.mutateAsync(result.body).then(submitOnce.hold, () => undefined)
      }
    })
  )

  // ADM-34 (spec 08 กฎ 38): ปิดแล้ว focus กลับปุ่มที่เปิด
  const restoreFocus = useRestoreOpenerFocus()
  // ADM-27 (spec 08 กฎ 31): ฟอร์ม dirty ถามก่อนปิด; ระหว่างบันทึกไม่ปิด (เงื่อนไขเดิม)
  const confirmClose = useConfirmDiscard({ form, isPending: save.isPending, onClose })

  const saveButton = (
    <Button size="small" type="submit" isLoading={save.isPending} disabled={submitLocked} data-testid="affiliate-program-save">
      {t("actions.save", { ns: "translation" })}
    </Button>
  )

  if (program) {
    return (
      <Drawer open onOpenChange={confirmClose}>
        <Drawer.Content
          {...restoreFocus}
          onEscapeKeyDown={keepModalOpenWhileComboboxExpanded}
          data-testid="affiliate-program-drawer"
        >
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <Drawer.Header>
                <Drawer.Title asChild>
                  <Heading>{t("programForm.editTitle")}</Heading>
                </Drawer.Title>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-y-4 overflow-auto">
                <ProgramFields form={form} program={program} />
              </Drawer.Body>
              <Drawer.Footer>
                <div className="flex items-center justify-end gap-x-2">
                  <Drawer.Close asChild>
                    <Button size="small" variant="secondary" type="button" disabled={save.isPending}>
                      {t("actions.cancel", { ns: "translation" })}
                    </Button>
                  </Drawer.Close>
                  {saveButton}
                </div>
              </Drawer.Footer>
            </KeyboundForm>
          </Form>
        </Drawer.Content>
      </Drawer>
    )
  }

  return (
    <FocusModal open onOpenChange={confirmClose}>
      <FocusModal.Content {...restoreFocus} onEscapeKeyDown={keepModalOpenWhileComboboxExpanded}>
        <Form {...form}>
          {/* noValidate: validation เป็นของ resolver (error ใต้ช่อง) ไม่ให้ browser ดัก input number ก่อน */}
          <KeyboundForm noValidate onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">{saveButton}</div>
            </FocusModal.Header>
            <FocusModal.Body className="flex justify-center overflow-auto py-16">
              <div className="flex w-full max-w-lg flex-col gap-y-4">
                <FocusModal.Title asChild>
                  <Heading>{t("programForm.createTitle")}</Heading>
                </FocusModal.Title>
                <ProgramFields form={form} />
              </div>
            </FocusModal.Body>
          </KeyboundForm>
        </Form>
      </FocusModal.Content>
    </FocusModal>
  )
}
