import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Form, KeyboundForm, SectionRow } from "@medusajs/dashboard/components"
import { useProduct } from "@medusajs/dashboard/hooks"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Badge, Button, FocusModal, Heading, Input, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Container } from "../components/common/container"
import { Header } from "../components/common/header"
import { NumberInput } from "../components/common/number-input"
import { useConfirmDiscard } from "../components/common/use-confirm-discard"
import { useRestoreOpenerFocus } from "../components/common/use-restore-opener-focus"
import { evoucherApi, evoucherKeys } from "../lib/evoucher"
import {
  POOL_FORM_DEFAULTS,
  POOL_PARSE_OPTIONS,
  type PoolFormBody,
  poolFormSchema,
} from "../lib/evoucher-pool-form"
import {
  EVOUCHER_POOL_PREREQUISITE_FIELDS,
  evoucherPoolPrerequisites,
} from "../lib/evoucher-pool-prerequisites"
import { useSingleFlight } from "../lib/single-flight"

// ตัวเลือก partner ของฟอร์ม Create pool คงเพดานเดิม (ทำเป็น Combobox ค้นหาได้นอกขอบเขต ADM-5)
const PARTNER_SELECT_QUERY = { limit: 100, offset: 0 }

// EV-6: "Voucher pool" บนหน้า variant — พาร์ทเนอร์, face value, สต็อกจาก pool; ยังไม่มี pool → สร้างได้ที่นี่
const VariantEvoucherPoolWidget = ({ data: variant }: DetailWidgetProps<HttpTypes.AdminProductVariant>) => {
  const { t } = useTranslation("ecom-evoucher")
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // ADM-3 (spec 08 กฎ 8): Form + KeyboundForm ของ dashboard + zod — error แสดงใต้ช่อง, ⌘/Ctrl+Enter ส่งได้
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้วแปลงเป็น body ด้วย schema เดียวกันตอน submit
  const form = useForm({
    resolver: zodResolver(poolFormSchema, POOL_PARSE_OPTIONS, { raw: true }),
    defaultValues: POOL_FORM_DEFAULTS,
  })
  // กฎ 43 (ADM-39): สำเร็จแล้ว hold ระหว่าง modal กำลังปิด — release ตอนเปิดใหม่
  // กฎ 50 (ADM-46): `submitLocked` = in-flight หรือ hold — Save disabled ตลอดช่วงแอนิเมชันปิด
  const [submitOnce, submitLocked] = useSingleFlight()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: evoucherKeys.poolByVariant(variant.id),
    queryFn: () => evoucherApi.listPools({ variant_id: variant.id, limit: 1, offset: 0 }),
  })
  const pool = data?.pools[0]

  // modal-only: รายชื่อพาร์ทเนอร์โหลดเมื่อเปิดฟอร์ม
  const { data: partners } = useQuery({
    queryKey: [...evoucherKeys.partners, PARTNER_SELECT_QUERY],
    queryFn: () => evoucherApi.listPartners(PARTNER_SELECT_QUERY),
    enabled: open,
  })

  // EV-27 (spec 02 กฎข้อ 43a): เงื่อนไขของ variant โหลดเมื่อเปิด modal — ผลที่ใช้ต้องได้มาหลังกดเปิดครั้งนี้
  // (staleTime: 0 + enabled ทำให้ refetch ตอนเปิด แต่ระหว่างนั้น cache เก่ายังอยู่ → ถือว่ายังโหลดจนได้ผลใหม่)
  const [openedAt, setOpenedAt] = useState(0)
  const product = useProduct(
    variant.product_id ?? "",
    { fields: EVOUCHER_POOL_PREREQUISITE_FIELDS },
    { enabled: open && !!variant.product_id, staleTime: 0 }
  )
  const checked =
    product.status === "success"
      ? product.dataUpdatedAt >= openedAt
      : product.status === "error" && product.errorUpdatedAt >= openedAt
  const issues =
    checked && product.status === "success"
      ? product.product
        ? evoucherPoolPrerequisites(product.product, variant.id)
        : null
      : undefined

  const create = useMutation({
    mutationFn: (body: PoolFormBody) =>
      evoucherApi.createPool({ ...body, variant_id: variant.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evoucherKeys.poolByVariant(variant.id) })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
      toast.success(t("variantWidget.created"))
      setOpen(false)
      form.reset(POOL_FORM_DEFAULTS)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // กฎข้อ 11 (spec 02): dblclick / ⌘+Enter ซ้ำก่อน isPending เป็น true → POST ครั้งเดียว; error แสดงผ่าน onError แล้ว
  const submit = form.handleSubmit((values) =>
    submitOnce(() =>
      create.mutateAsync(poolFormSchema.parse(values, POOL_PARSE_OPTIONS)).then(submitOnce.hold, () => undefined)
    )
  )

  // ADM-34 (spec 08 กฎ 38): ปิดแล้ว focus กลับปุ่มที่เปิด
  const restoreFocus = useRestoreOpenerFocus()
  // ADM-27 (spec 08 กฎ 31): ฟอร์ม dirty ถามก่อนปิด และยืนยันแล้วล้างค่า (เปิดใหม่ฟอร์มว่าง); ระหว่างบันทึกไม่ปิด
  const confirmClose = useConfirmDiscard({
    form,
    isPending: create.isPending,
    onClose: () => {
      setOpen(false)
      form.reset(POOL_FORM_DEFAULTS)
    },
  })

  // heading เดียวกันทุกสถานะของ modal (กฎ admin-dialog-title)
  const title = (
    <FocusModal.Title asChild>
      <Heading>{t("variantWidget.createTitle", { title: variant.title ?? "" })}</Heading>
    </FocusModal.Title>
  )

  // ช่องตัวเลขผ่าน NumberInput ของกลาง (ADM-12, spec 08 กฎ 15) — "e" ไม่ถูกถือเป็นค่าว่าง/ค่า default
  const field = (name: "name" | "face_value" | "validity_note" | "low_stock_threshold", label: string, numeric = false) => (
    <Form.Field
      control={form.control}
      name={name}
      render={({ field }) => (
        <Form.Item>
          <Form.Label>{label}</Form.Label>
          <Form.Control>
            {numeric ? <NumberInput {...field} size="small" /> : <Input {...field} size="small" />}
          </Form.Control>
          <Form.ErrorMessage data-testid={`evoucher-pool-${name}-error`} />
        </Form.Item>
      )}
    />
  )

  return (
    <Container>
      <Header
        title={t("variantWidget.title")}
        actions={
          pool
            ? [
                {
                  type: "button",
                  props: { variant: "secondary", children: t("variantWidget.manageCodes") },
                  link: { to: `/evouchers/pools/${pool.id}` },
                },
              ]
            : !isLoading && !isError
              ? [
                  {
                    type: "button",
                    props: {
                      variant: "secondary",
                      onClick: () => {
                        submitOnce.release()
                        setOpenedAt(Date.now())
                        setOpen(true)
                      },
                      children: t("variantWidget.createPool"),
                      "data-testid": "evoucher-pool-create",
                    },
                  },
                ]
              : []
        }
      />
      {isLoading ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          {t("general.loading")}
        </Text>
      ) : isError ? (
        <Text size="small" leading="compact" className="text-ui-fg-error px-6 py-4">
          {t("variantWidget.loadError", { message: error.message })}
        </Text>
      ) : !pool ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          {t("variantWidget.notEvoucher")}
        </Text>
      ) : (
        <>
          <SectionRow title={t("fields.partner")} value={pool.partner.name} />
          <SectionRow title={t("fields.faceValue")} value={pool.face_value?.toString() ?? "-"} />
          <SectionRow
            title={t("variantWidget.availableCodes")}
            value={
              <span className="flex items-center gap-x-2">
                {pool.code_counts.available}
                {pool.low_stock && (
                  <Badge size="2xsmall" color="red">
                    {t("stock.lowShort")}
                  </Badge>
                )}
              </span>
            }
          />
          <SectionRow title={t("variantWidget.delivered")} value={pool.code_counts.delivered.toString()} />
        </>
      )}

      <FocusModal open={open} onOpenChange={confirmClose}>
        <FocusModal.Content {...restoreFocus}>
          {issues && issues.length === 0 ? (
              <Form {...form}>
                <KeyboundForm
                  noValidate
                  onSubmit={submit}
                  data-testid="evoucher-pool-form" className="flex h-full flex-col overflow-hidden">
                  <FocusModal.Header>
                    <div className="flex items-center justify-end gap-x-2">
                      <Button size="small" type="submit" disabled={submitLocked} isLoading={create.isPending}>
                        {t("actions.save", { ns: "translation" })}
                      </Button>
                    </div>
                  </FocusModal.Header>
                  <FocusModal.Body className="flex flex-1 justify-center overflow-auto py-16">
                    <div className="flex w-full max-w-lg flex-col gap-y-4">
                      {title}
                      <Form.Field
                        control={form.control}
                        name="partner_id"
                        render={({ field: { value, onChange, ref, name, disabled } }) => (
                          <Form.Item>
                            <Form.Label>{t("fields.partnerRequired")}</Form.Label>
                            <Select size="small" name={name} value={value} onValueChange={onChange} disabled={disabled}>
                              <Form.Control>
                                <Select.Trigger ref={ref}>
                                  <Select.Value placeholder={t("fields.selectPartner")} />
                                </Select.Trigger>
                              </Form.Control>
                              <Select.Content>
                                {partners?.partners.map((p) => (
                                  <Select.Item key={p.id} value={p.id}>
                                    {p.name}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                            <Form.ErrorMessage data-testid="evoucher-pool-partner_id-error" />
                          </Form.Item>
                        )}
                      />
                      {field("name", t("fields.nameRequired"))}
                      <Form.Field
                        control={form.control}
                        name="how_to_use"
                        render={({ field }) => (
                          <Form.Item>
                            <Form.Label>{t("fields.howToUseRequired")}</Form.Label>
                            <Form.Control>
                              <Textarea {...field} />
                            </Form.Control>
                            <Form.ErrorMessage data-testid="evoucher-pool-how_to_use-error" />
                          </Form.Item>
                        )}
                      />
                      {field("face_value", t("fields.faceValue"), true)}
                      {field("validity_note", t("fields.validityNote"))}
                      {field("low_stock_threshold", t("fields.lowStockThreshold"), true)}
                    </div>
                  </FocusModal.Body>
                </KeyboundForm>
              </Form>
          ) : (
            // กฎข้อ 43c กรณี 1–3: ไม่มีฟอร์ม/ปุ่ม Save → ไม่มีทางยิง POST (⌘/Ctrl+Enter ก็ไม่ส่ง)
            <div className="flex h-full flex-col overflow-hidden">
              <FocusModal.Header />
              <FocusModal.Body className="flex flex-1 justify-center overflow-auto py-16">
                <div className="flex w-full max-w-lg flex-col gap-y-4">
                  {title}
                  {!checked ? (
                    <Text size="small" className="text-ui-fg-subtle" data-testid="evoucher-pool-prerequisites-loading">
                      {t("general.loading")}
                    </Text>
                  ) : !issues ? (
                    <Text size="small" className="text-ui-fg-error" data-testid="evoucher-pool-prerequisites-error">
                      {t("variantWidget.prerequisites.loadError", {
                        message: product.error?.message ?? t("variantWidget.prerequisites.variantMissing"),
                      })}
                    </Text>
                  ) : (
                    <div className="flex flex-col gap-y-3" data-testid="evoucher-pool-prerequisites">
                      <Text size="small" weight="plus">
                        {t("variantWidget.prerequisites.title")}
                      </Text>
                      {issues.map((issue) => (
                        <div
                          key={issue.code}
                          className="flex items-start justify-between gap-x-4"
                          data-testid={`evoucher-pool-prereq-${issue.code}`}
                        >
                          <Text size="small" className="text-ui-fg-subtle">
                            {t(`variantWidget.prerequisites.${issue.code}`)}
                          </Text>
                          <Link
                            to={issue.to}
                            onClick={() => setOpen(false)}
                            className="txt-compact-small-plus text-ui-fg-interactive hover:text-ui-fg-interactive-hover shrink-0"
                            data-testid={`evoucher-pool-prereq-${issue.code}-link`}
                          >
                            {t("variantWidget.prerequisites.fix")}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FocusModal.Body>
            </div>
          )}
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.side",
})

export default VariantEvoucherPoolWidget
