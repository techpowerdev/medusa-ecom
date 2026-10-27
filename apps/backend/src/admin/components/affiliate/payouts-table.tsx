import { Badge, Button, createDataTableColumnHelper, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { affiliateKeys, cancelPayout, formatDate, Payout } from "../../lib/affiliate"
import { canCancelPayout, singleFlight } from "../../lib/affiliate-payout"
import { AffiliateListTable } from "./list-table"

const columnHelper = createDataTableColumnHelper<Payout>()

// AF-6 (spec 05 AC-26): เฉพาะแถว `draft` มีปุ่มยกเลิก (route ของ AF-9) ยืนยันด้วย usePrompt และกันกดซ้ำ
export const PayoutsTable = () => {
  const prompt = usePrompt()
  const queryClient = useQueryClient()

  const cancel = useMutation({
    mutationFn: cancelPayout,
    onSuccess: () => {
      toast.success("Payout cancelled")
      return queryClient.invalidateQueries({
        queryKey: affiliateKeys.list("payouts"),
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // กล่องยืนยันเปิดอยู่หรือ request ยังไม่จบ → คลิกซ้ำ (dblclick) ถูกเพิกเฉย
  const confirmCancel = useMemo(
    () =>
      singleFlight(async (id: string) => {
        const ok = await prompt({
          title: "Cancel this draft payout?",
          description: "The payout is removed and its entries can be picked up by the next payout.",
          confirmText: "Cancel payout",
          cancelText: "Keep payout",
        })
        if (ok) {
          await cancel.mutateAsync(id).catch(() => undefined)
        }
      }),
    [prompt, cancel.mutateAsync],
  )

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: "Payout" }),
      columnHelper.accessor("affiliate_id", { header: "Affiliate" }),
      columnHelper.accessor(
        (row) => `${formatDate(row.period_from, false)} – ${formatDate(row.period_to, false)}`,
        {
          id: "period",
          header: "Period",
        },
      ),
      columnHelper.accessor((row) => `${row.amount} ${row.currency.toUpperCase()}`, {
        id: "amount",
        header: "Amount",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge size="2xsmall" color={getValue() === "paid" ? "green" : "orange"}>
            {getValue()}
          </Badge>
        ),
      }),
      columnHelper.accessor("paid_at", {
        header: "Paid at",
        cell: ({ getValue }) => formatDate(getValue()),
      }),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) =>
          canCancelPayout(row.original) ? (
            <Button
              size="small"
              variant="secondary"
              data-testid="affiliate-payout-cancel"
              disabled={cancel.isPending}
              onClick={() => confirmCancel(row.original.id)}
            >
              Cancel
            </Button>
          ) : null,
      }),
    ],
    [cancel.isPending, confirmCancel],
  )

  return <AffiliateListTable resource="payouts" columns={columns} empty="No payouts yet" />
}
