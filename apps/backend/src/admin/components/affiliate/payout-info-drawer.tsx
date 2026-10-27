import { Button, Drawer, Input, Label, Text, toast } from "@medusajs/ui"
import { useId, useState } from "react"
import { AdminAffiliate } from "../../lib/affiliate"
import { parsePayoutInfo, PAYOUT_INFO_FIELDS, PayoutInfo, payoutInfoForm } from "../../lib/affiliate-account"
import { createSingleFlight } from "../../lib/single-flight"

const LABELS: Record<keyof PayoutInfo, string> = {
  bank_name: "Bank name",
  account_name: "Account name",
  account_number: "Account number",
}

type Props = {
  affiliate: AdminAffiliate
  onClose: () => void
  /** resolve เมื่อบันทึกสำเร็จ, reject เมื่อ API ล้ม (toast/refetch ทำที่ตาราง) */
  save: (payoutInfo: PayoutInfo | null) => Promise<unknown>
}

// AF-12b (กฎ 37b): ฟอร์มข้อมูลรับเงิน 3 ช่อง (owner Q18) — Save ส่ง object, Clear ส่ง null; ค่าเต็มเห็นเฉพาะ admin (กฎ 8)
export const PayoutInfoDrawer = ({ affiliate, onClose, save }: Props) => {
  const prefix = useId()
  const [form, setForm] = useState(() => payoutInfoForm(affiliate.payout_info))
  const [errors, setErrors] = useState<Partial<PayoutInfo>>({})
  const [pending, setPending] = useState(false)
  // instance คงที่ตลอดอายุ component (กฎ 37) — dblclick Save/Clear = 1 request
  const [submitOnce] = useState(createSingleFlight)

  const send = (payoutInfo: PayoutInfo | null) =>
    submitOnce(async () => {
      setPending(true)
      try {
        await save(payoutInfo)
        onClose()
      } catch {
        // error แสดงผ่าน onError ของ mutation แล้ว
      } finally {
        setPending(false)
      }
    })

  const submit = () => {
    const parsed = parsePayoutInfo(form)
    if (!parsed.ok) {
      setErrors(parsed.errors)
      toast.error("Fill in all payout fields")
      return
    }
    setErrors({})
    send(parsed.value)
  }

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content data-testid="affiliate-payout-info-drawer">
        <Drawer.Header>
          <Drawer.Title>Payout info — {affiliate.name}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-4 p-4">
          {PAYOUT_INFO_FIELDS.map((key) => (
            <div key={key} className="flex flex-col gap-y-2">
              <Label size="small" htmlFor={`${prefix}-${key}`}>
                {LABELS[key]} *
              </Label>
              <Input
                id={`${prefix}-${key}`}
                size="small"
                data-testid={`affiliate-payout-info-${key}`}
                value={form[key]}
                aria-invalid={!!errors[key]}
                onChange={(e) => {
                  setForm({ ...form, [key]: e.target.value })
                  setErrors({ ...errors, [key]: undefined })
                }}
              />
              {errors[key] && (
                <Text size="small" className="text-ui-fg-error" data-testid="affiliate-payout-info-error">
                  {errors[key]}
                </Text>
              )}
            </div>
          ))}
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            size="small"
            variant="danger"
            data-testid="affiliate-payout-info-clear"
            disabled={pending || !affiliate.payout_info}
            onClick={() => send(null)}
          >
            Clear
          </Button>
          <Button
            size="small"
            data-testid="affiliate-payout-info-save"
            disabled={pending}
            isLoading={pending}
            onClick={submit}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
