import { Button, Input, Label, Prompt, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { affiliateKeys, markPayoutPaid, Payout } from "../../lib/affiliate"
import { formatAmount } from "../../lib/affiliate-format"
import { markPaidBody } from "../../lib/affiliate-payout"
import { createSingleFlight } from "../../lib/single-flight"

/**
 * AF-12c (spec 05 กฎ 37c): กล่องยืนยัน mark paid พร้อมช่อง `reference` (ไม่บังคับ)
 * `usePrompt` ของ @medusajs/ui ไม่มีช่องกรอกข้อความ จึงใช้ `Prompt` (alertdialog เดียวกัน) ประกอบเอง
 * component ถูก mount ต่อการเปิดแต่ละครั้ง — ปิดโดยไม่ยืนยัน = ไม่มี request
 */
export const MarkPaidPrompt = ({ payout, onClose }: { payout: Payout; onClose: () => void }) => {
  const queryClient = useQueryClient()
  const id = useId()
  const [reference, setReference] = useState("")
  const [submitOnce] = useState(createSingleFlight)

  // mark paid เปลี่ยนทั้ง payout และ entry ของมัน (approved → paid)
  const refetch = () =>
    Promise.all(
      (["payouts", "entries"] as const).map((r) =>
        queryClient.invalidateQueries({ queryKey: affiliateKeys.list(r) }),
      ),
    )

  const markPaid = useMutation({
    mutationFn: () => markPayoutPaid(payout.id, markPaidBody(reference)),
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

  const confirm = () => submitOnce(() => markPaid.mutateAsync().catch(() => undefined))

  return (
    <Prompt open variant="confirmation" onOpenChange={(open) => !open && !markPaid.isPending && onClose()}>
      <Prompt.Content>
        <Prompt.Header>
          <Prompt.Title>Mark payout as paid?</Prompt.Title>
          <Prompt.Description>
            Confirm the bank transfer of {formatAmount(payout.amount, payout.currency)} was made. Its entries become
            paid. This cannot be undone.
          </Prompt.Description>
        </Prompt.Header>
        <div className="flex flex-col gap-y-2 px-6 pb-6">
          <Label size="small" htmlFor={`${id}-reference`}>
            Transfer reference (optional)
          </Label>
          <Input
            id={`${id}-reference`}
            size="small"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            data-testid="affiliate-payout-mark-paid-reference"
          />
        </div>
        <Prompt.Footer>
          <Prompt.Cancel disabled={markPaid.isPending} data-testid="affiliate-payout-mark-paid-dismiss">
            Keep as draft
          </Prompt.Cancel>
          <Button
            size="small"
            onClick={confirm}
            isLoading={markPaid.isPending}
            disabled={markPaid.isPending}
            data-testid="affiliate-payout-mark-paid-confirm"
          >
            Mark as paid
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  )
}
