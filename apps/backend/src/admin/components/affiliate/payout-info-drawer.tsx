import { Form, KeyboundForm } from "@medusajs/dashboard/components"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Drawer, Input, toast, usePrompt } from "@medusajs/ui"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { AdminAffiliate } from "../../lib/affiliate"
import { PAYOUT_INFO_FIELDS, PayoutInfo, payoutInfoForm, payoutInfoSchema } from "../../lib/affiliate-account"
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
// ADM-9 (spec 08 กฎ 8): Form + KeyboundForm + zod
export const PayoutInfoDrawer = ({ affiliate, onClose, save }: Props) => {
  const prompt = usePrompt()
  const form = useForm<PayoutInfo>({
    resolver: zodResolver(payoutInfoSchema, undefined, { raw: true }),
    defaultValues: payoutInfoForm(affiliate.payout_info),
  })
  const [pending, setPending] = useState(false)
  // instance คงที่ตลอดอายุ component (กฎ 37) — dblclick Save/Clear = 1 request
  const [submitOnce] = useState(createSingleFlight)

  const send = (payoutInfo: PayoutInfo | null) =>
    submitOnce(async () => {
      // AF-15 (กฎ 39c): Clear ต้องยืนยันก่อนส่ง null — ยกเลิก = ไม่มี request
      if (
        payoutInfo === null &&
        !(await prompt({
          title: `Clear payout info of ${affiliate.name}?`,
          description: "Bank name, account name and account number are removed.",
          confirmText: "Clear",
          cancelText: "Cancel",
        }))
      ) {
        return
      }
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

  const submit = form.handleSubmit(
    // resolver เป็น raw → parse อีกครั้งเพื่อได้ค่าที่ trim/normalize แล้ว (แบบ ADM-3/ADM-7)
    (values) => send(payoutInfoSchema.parse(values)),
    () => {
      toast.error("Fill in all payout fields")
    }
  )

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content data-testid="affiliate-payout-info-drawer">
        <Form {...form}>
          <KeyboundForm noValidate onSubmit={submit} className="flex h-full flex-col overflow-hidden">
            <Drawer.Header>
              <Drawer.Title>Payout info — {affiliate.name}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-auto p-4">
              {PAYOUT_INFO_FIELDS.map((key) => (
                <Form.Field
                  key={key}
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <Form.Item>
                      <Form.Label>{LABELS[key]} *</Form.Label>
                      <Form.Control>
                        <Input {...field} size="small" data-testid={`affiliate-payout-info-${key}`} />
                      </Form.Control>
                      <Form.ErrorMessage data-testid="affiliate-payout-info-error" />
                    </Form.Item>
                  )}
                />
              ))}
            </Drawer.Body>
            <Drawer.Footer>
              <Button
                size="small"
                variant="danger"
                type="button"
                data-testid="affiliate-payout-info-clear"
                disabled={pending || !affiliate.payout_info}
                onClick={() => send(null)}
              >
                Clear
              </Button>
              <Button
                size="small"
                type="submit"
                data-testid="affiliate-payout-info-save"
                disabled={pending}
                isLoading={pending}
              >
                Save
              </Button>
            </Drawer.Footer>
          </KeyboundForm>
        </Form>
      </Drawer.Content>
    </Drawer>
  )
}
