import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import {
  Badge,
  Button,
  Container,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"
import { evoucherApi, evoucherKeys } from "../lib/evoucher"

const EMPTY = {
  partner_id: "",
  name: "",
  how_to_use: "",
  face_value: "",
  validity_note: "",
  low_stock_threshold: "20",
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="small" leading="compact" weight="plus">
      {value}
    </Text>
  </div>
)

// EV-6: "Voucher pool" บนหน้า variant — พาร์ทเนอร์, face value, สต็อกจาก pool; ยังไม่มี pool → สร้างได้ที่นี่
const VariantEvoucherPoolWidget = ({ data: variant }: DetailWidgetProps<HttpTypes.AdminProductVariant>) => {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: evoucherKeys.poolByVariant(variant.id),
    queryFn: () => evoucherApi.listPools({ variant_id: variant.id, limit: 1, offset: 0 }),
  })
  const pool = data?.pools[0]

  // modal-only: รายชื่อพาร์ทเนอร์โหลดเมื่อเปิดฟอร์ม
  const { data: partners } = useQuery({
    queryKey: evoucherKeys.partners,
    queryFn: evoucherApi.listPartners,
    enabled: open,
  })

  const create = useMutation({
    mutationFn: () =>
      evoucherApi.createPool({
        variant_id: variant.id,
        partner_id: form.partner_id,
        name: form.name.trim(),
        how_to_use: form.how_to_use.trim(),
        face_value: form.face_value ? Number(form.face_value) : null,
        validity_note: form.validity_note.trim() || null,
        low_stock_threshold: Number(form.low_stock_threshold || 20),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evoucherKeys.poolByVariant(variant.id) })
      queryClient.invalidateQueries({ queryKey: evoucherKeys.pools })
      toast.success("Voucher pool created")
      setOpen(false)
      setForm(EMPTY)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = () => {
    if (!form.partner_id || !form.name.trim() || !form.how_to_use.trim()) {
      toast.error("Partner, name and how to use are required")
      return
    }
    create.mutate()
  }

  const field = (key: keyof typeof EMPTY, label: string, type = "text") => (
    <div className="flex flex-col gap-y-2">
      <Label size="small">{label}</Label>
      <Input
        size="small"
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Voucher pool</Heading>
        {pool ? (
          <Button size="small" variant="secondary" asChild>
            <Link to={`/evouchers/pools/${pool.id}`}>Manage codes</Link>
          </Button>
        ) : (
          !isLoading &&
          !isError && (
            <Button size="small" variant="secondary" onClick={() => setOpen(true)}>
              Create pool
            </Button>
          )
        )}
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {isLoading ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Loading…
          </Text>
        ) : isError ? (
          <Text size="small" leading="compact" className="text-ui-fg-error">
            Could not load voucher pool: {error.message}
          </Text>
        ) : !pool ? (
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            This variant is not an e-voucher.
          </Text>
        ) : (
          <>
            <Row label="Partner" value={pool.partner.name} />
            <Row label="Face value" value={pool.face_value ?? "-"} />
            <Row
              label="Available codes"
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
            <Row label="Delivered" value={pool.code_counts.delivered} />
          </>
        )}
      </div>

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <Button size="small" onClick={submit} isLoading={create.isPending}>
                Save
              </Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex justify-center overflow-auto py-16">
            <div className="flex w-full max-w-lg flex-col gap-y-4">
              <Heading>Create voucher pool for {variant.title}</Heading>
              <div className="flex flex-col gap-y-2">
                <Label size="small">Partner *</Label>
                <Select
                  size="small"
                  value={form.partner_id}
                  onValueChange={(partner_id) => setForm({ ...form, partner_id })}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select partner" />
                  </Select.Trigger>
                  <Select.Content>
                    {partners?.partners.map((p) => (
                      <Select.Item key={p.id} value={p.id}>
                        {p.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              {field("name", "Name *")}
              <div className="flex flex-col gap-y-2">
                <Label size="small">How to use * (shown in the delivery email)</Label>
                <Textarea
                  value={form.how_to_use}
                  onChange={(e) => setForm({ ...form, how_to_use: e.target.value })}
                />
              </div>
              {field("face_value", "Face value", "number")}
              {field("validity_note", "Validity note")}
              {field("low_stock_threshold", "Low-stock threshold", "number")}
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.side",
})

export default VariantEvoucherPoolWidget
