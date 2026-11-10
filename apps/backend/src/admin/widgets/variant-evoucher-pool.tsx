import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Form, KeyboundForm, SectionRow } from "@medusajs/dashboard/components"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Badge, Button, FocusModal, Heading, Input, Select, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Container } from "../components/common/container"
import { Header } from "../components/common/header"
import { NumberInput } from "../components/common/number-input"
import { evoucherApi, evoucherKeys } from "../lib/evoucher"
import {
  POOL_FORM_DEFAULTS,
  POOL_PARSE_OPTIONS,
  type PoolFormBody,
  poolFormSchema,
} from "../lib/evoucher-pool-form"
import { createSingleFlight } from "../lib/single-flight"

// ตัวเลือก partner ของฟอร์ม Create pool คงเพดานเดิม (ทำเป็น Combobox ค้นหาได้นอกขอบเขต ADM-5)
const PARTNER_SELECT_QUERY = { limit: 100, offset: 0 }

// EV-6: "Voucher pool" บนหน้า variant — พาร์ทเนอร์, face value, สต็อกจาก pool; ยังไม่มี pool → สร้างได้ที่นี่
const VariantEvoucherPoolWidget = ({ data: variant }: DetailWidgetProps<HttpTypes.AdminProductVariant>) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // ADM-3 (spec 08 กฎ 8): Form + KeyboundForm ของ dashboard + zod — error แสดงใต้ช่อง, ⌘/Ctrl+Enter ส่งได้
  // Form.Field ของ dashboard รับ control ที่ค่าก่อน/หลัง submit เป็น type เดียวกัน จึงให้ resolver คืนค่าดิบ (raw)
  // แล้วแปลงเป็น body ด้วย schema เดียวกันตอน submit
  const form = useForm({
    resolver: zodResolver(poolFormSchema, POOL_PARSE_OPTIONS, { raw: true }),
    defaultValues: POOL_FORM_DEFAULTS,
  })
  const [submitOnce] = useState(createSingleFlight)

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

  const create = useMutation({
    mutationFn: (body: PoolFormBody) =>
      evoucherApi.createPool({ ...body, variant_id: variant.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evoucherKeys.poolByVariant(variant.id) })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
      toast.success("Voucher pool created")
      setOpen(false)
      form.reset(POOL_FORM_DEFAULTS)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // กฎข้อ 11 (spec 02): dblclick / ⌘+Enter ซ้ำก่อน isPending เป็น true → POST ครั้งเดียว; error แสดงผ่าน onError แล้ว
  const submit = form.handleSubmit((values) =>
    submitOnce(() =>
      create.mutateAsync(poolFormSchema.parse(values, POOL_PARSE_OPTIONS)).catch(() => undefined)
    )
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
        title="Voucher pool"
        actions={
          pool
            ? [
                {
                  type: "button",
                  props: { variant: "secondary", children: "Manage codes" },
                  link: { to: `/evouchers/pools/${pool.id}` },
                },
              ]
            : !isLoading && !isError
              ? [
                  {
                    type: "button",
                    props: { variant: "secondary", onClick: () => setOpen(true), children: "Create pool" },
                  },
                ]
              : []
        }
      />
      {isLoading ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          Loading…
        </Text>
      ) : isError ? (
        <Text size="small" leading="compact" className="text-ui-fg-error px-6 py-4">
          Could not load voucher pool: {error.message}
        </Text>
      ) : !pool ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          This variant is not an e-voucher.
        </Text>
      ) : (
        <>
          <SectionRow title="Partner" value={pool.partner.name} />
          <SectionRow title="Face value" value={pool.face_value?.toString() ?? "-"} />
          <SectionRow
            title="Available codes"
            value={
              <span className="flex items-center gap-x-2">
                {pool.code_counts.available}
                {pool.low_stock && (
                  <Badge size="2xsmall" color="red">
                    Low stock
                  </Badge>
                )}
              </span>
            }
          />
          <SectionRow title="Delivered" value={pool.code_counts.delivered.toString()} />
        </>
      )}

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <Form {...form}>
            <KeyboundForm noValidate onSubmit={submit} className="flex h-full flex-col overflow-hidden">
              <FocusModal.Header>
                <div className="flex items-center justify-end gap-x-2">
                  <Button size="small" type="submit" disabled={create.isPending} isLoading={create.isPending}>
                    Save
                  </Button>
                </div>
              </FocusModal.Header>
              <FocusModal.Body className="flex flex-1 justify-center overflow-auto py-16">
                <div className="flex w-full max-w-lg flex-col gap-y-4">
                  <Heading>Create voucher pool for {variant.title}</Heading>
                  <Form.Field
                    control={form.control}
                    name="partner_id"
                    render={({ field: { value, onChange, ref, name, disabled } }) => (
                      <Form.Item>
                        <Form.Label>Partner *</Form.Label>
                        <Select size="small" name={name} value={value} onValueChange={onChange} disabled={disabled}>
                          <Form.Control>
                            <Select.Trigger ref={ref}>
                              <Select.Value placeholder="Select partner" />
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
                  {field("name", "Name *")}
                  <Form.Field
                    control={form.control}
                    name="how_to_use"
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>How to use * (shown in the delivery email)</Form.Label>
                        <Form.Control>
                          <Textarea {...field} />
                        </Form.Control>
                        <Form.ErrorMessage data-testid="evoucher-pool-how_to_use-error" />
                      </Form.Item>
                    )}
                  />
                  {field("face_value", "Face value", true)}
                  {field("validity_note", "Validity note")}
                  {field("low_stock_threshold", "Low-stock threshold", true)}
                </div>
              </FocusModal.Body>
            </KeyboundForm>
          </Form>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.side",
})

export default VariantEvoucherPoolWidget
