import { Form, KeyboundForm } from "@medusajs/dashboard/components"
import { castNumber, getLocaleAmount } from "@medusajs/dashboard/lib"
import { Button, Input, Prompt, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { affiliateKeys, markPayoutPaid, Payout } from "../../lib/affiliate"
import { markPaidBody } from "../../lib/affiliate-payout"
import { createSingleFlight } from "../../lib/single-flight"

/**
 * AF-12c (spec 05 กฎ 37c): กล่องยืนยัน mark paid พร้อมช่อง `reference` (ไม่บังคับ)
 * `usePrompt` ของ @medusajs/ui ไม่มีช่องกรอกข้อความ จึงใช้ `Prompt` (alertdialog เดียวกัน) ประกอบเอง
 * component ถูก mount ต่อการเปิดแต่ละครั้ง — ปิดโดยไม่ยืนยัน = ไม่มี request
 * ADM-9 (spec 08 กฎ 8): Form + KeyboundForm — ⌘/Ctrl+Enter ยืนยันได้; `reference` ไม่บังคับจึงไม่มี schema
 */
export const MarkPaidPrompt = ({ payout, onClose }: { payout: Payout; onClose: () => void }) => {
  const queryClient = useQueryClient()
  const form = useForm({ defaultValues: { reference: "" } })
  const [submitOnce] = useState(createSingleFlight)

  // mark paid เปลี่ยนทั้ง payout และ entry ของมัน (approved → paid)
  const refetch = () =>
    Promise.all(
      (["payouts", "entries"] as const).map((r) =>
        queryClient.invalidateQueries({ queryKey: affiliateKeys.list(r) }),
      ),
    )

  const markPaid = useMutation({
    // ADM-8b: key เดียวกับ cancel ของ payout นี้ — เมนูของแถว disable ระหว่างส่ง (และระหว่าง refetch หลังสำเร็จ)
    mutationKey: affiliateKeys.payoutAction(payout.id),
    mutationFn: (reference: string) => markPayoutPaid(payout.id, markPaidBody(reference)),
    onSuccess: () => {
      toast.success("Payout marked as paid")
      onClose()
      return refetch()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      onClose()
      return refetch()
    },
  })

  const confirm = form.handleSubmit(({ reference }) =>
    submitOnce(() => markPaid.mutateAsync(reference).catch(() => undefined))
  )

  return (
    <Prompt open variant="confirmation" onOpenChange={(open) => !open && !markPaid.isPending && onClose()}>
      <Prompt.Content>
        <Form {...form}>
          <KeyboundForm noValidate onSubmit={confirm}>
            <Prompt.Header>
              <Prompt.Title>Mark payout as paid?</Prompt.Title>
              <Prompt.Description>
                Confirm the bank transfer of {getLocaleAmount(castNumber(payout.amount), payout.currency)} was made. Its entries become
                paid. This cannot be undone.
              </Prompt.Description>
            </Prompt.Header>
            <div className="px-6 pb-6">
              <Form.Field
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <Form.Item>
                    <Form.Label>Transfer reference (optional)</Form.Label>
                    <Form.Control>
                      <Input {...field} size="small" data-testid="affiliate-payout-mark-paid-reference" />
                    </Form.Control>
                  </Form.Item>
                )}
              />
            </div>
            <Prompt.Footer>
              <Prompt.Cancel disabled={markPaid.isPending} data-testid="affiliate-payout-mark-paid-dismiss">
                Keep as draft
              </Prompt.Cancel>
              <Button
                size="small"
                type="submit"
                isLoading={markPaid.isPending}
                disabled={markPaid.isPending}
                data-testid="affiliate-payout-mark-paid-confirm"
              >
                Mark as paid
              </Button>
            </Prompt.Footer>
          </KeyboundForm>
        </Form>
      </Prompt.Content>
    </Prompt>
  )
}
