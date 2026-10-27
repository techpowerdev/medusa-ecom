import { Button, FocusModal, Heading, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { affiliateKeys, createPayout, listAffiliatesByStatus } from "../../lib/affiliate"
import {
  defaultPayoutPeriod,
  mergeAffiliateOptions,
  PayoutForm,
  toPayoutBody,
} from "../../lib/affiliate-payout"
import { createSingleFlight } from "../../lib/single-flight"

// filter status รับค่าเดียว → ยิง active และ suspended แยก (limit 200) แล้วรวมผล; pending ไม่อยู่ในตัวเลือก
const useAffiliateOptions = () =>
  useQuery({
    queryKey: [...affiliateKeys.list("affiliates"), "payout-options"],
    queryFn: async () => {
      const [active, suspended] = await Promise.all([
        listAffiliatesByStatus("active"),
        listAffiliatesByStatus("suspended"),
      ])
      return mergeAffiliateOptions(active.affiliates, suspended.affiliates)
    },
  })

/** AF-12c (spec 05 กฎ 37c): FocusModal สร้าง payout — ช่วงเริ่มต้น = เดือนก่อนตามเวลาไทย; 400 → toast และไม่มีแถวใหม่ */
export const PayoutFormModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient()
  const prefix = useId()
  const [form, setForm] = useState<PayoutForm>(() => ({ affiliate_id: "", ...defaultPayoutPeriod(new Date()) }))
  const [error, setError] = useState<{ field: keyof PayoutForm; message: string } | null>(null)
  const [submitOnce] = useState(createSingleFlight)
  const options = useAffiliateOptions()

  const set = (patch: Partial<PayoutForm>) => {
    setError(null)
    setForm((f) => ({ ...f, ...patch }))
  }
  const refetch = () => queryClient.invalidateQueries({ queryKey: affiliateKeys.list("payouts") })

  const save = useMutation({
    mutationFn: createPayout,
    onSuccess: () => {
      toast.success("Payout created")
      onClose()
      return refetch()
    },
    onError: (e: Error) => {
      toast.error(e.message)
      return refetch()
    },
  })

  const submit = () =>
    submitOnce(async () => {
      const result = toPayoutBody(form)
      if ("error" in result) {
        setError({ field: result.field, message: result.error })
        return
      }
      await save.mutateAsync(result.body).catch(() => undefined)
    })

  const fieldError = (key: keyof PayoutForm) =>
    error?.field === key && (
      <Text size="xsmall" className="text-ui-fg-error" data-testid={`affiliate-payout-error-${key}`}>
        {error.message}
      </Text>
    )

  return (
    <FocusModal open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center justify-end gap-x-2">
            <Button
              size="small"
              onClick={submit}
              isLoading={save.isPending}
              disabled={save.isPending}
              data-testid="affiliate-payout-save"
            >
              Create
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex justify-center overflow-auto py-16">
          <div className="flex w-full max-w-lg flex-col gap-y-4">
            <Heading>Create payout</Heading>
            <div className="flex flex-col gap-y-2">
              <Label size="small">Affiliate *</Label>
              <Select size="small" value={form.affiliate_id} onValueChange={(affiliate_id) => set({ affiliate_id })}>
                <Select.Trigger data-testid="affiliate-payout-field-affiliate_id">
                  <Select.Value placeholder={options.isLoading ? "Loading..." : "Select an affiliate"} />
                </Select.Trigger>
                <Select.Content>
                  {(options.data ?? []).map((a) => (
                    <Select.Item key={a.id} value={a.id} data-testid="affiliate-payout-affiliate-option">
                      {a.name} ({a.email}){a.status === "suspended" ? " — suspended" : ""}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              {fieldError("affiliate_id")}
            </div>
            {(
              [
                { key: "period_from", label: "From (ICT, inclusive) *" },
                { key: "period_to", label: "To (ICT, exclusive) *" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-y-2">
                <Label size="small" htmlFor={`${prefix}-${key}`}>
                  {label}
                </Label>
                <Input
                  id={`${prefix}-${key}`}
                  size="small"
                  type="date"
                  value={form[key]}
                  onChange={(e) => set({ [key]: e.target.value })}
                  aria-invalid={error?.field === key}
                  data-testid={`affiliate-payout-field-${key}`}
                />
                {fieldError(key)}
              </div>
            ))}
            <Text size="xsmall" className="text-ui-fg-subtle">
              Includes approved entries (and their reversals) created before To 00:00 Bangkok time that are not in
              another payout. From is recorded as the period start.
            </Text>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}
