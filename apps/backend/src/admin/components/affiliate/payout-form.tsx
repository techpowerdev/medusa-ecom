import { Combobox, Form, KeyboundForm } from "@medusajs/dashboard/components"
import { useComboboxData } from "@medusajs/dashboard/hooks"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, DatePicker, FocusModal, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { affiliateKeys, createPayout, listAffiliateOptions } from "../../lib/affiliate"
import {
  defaultPayoutPeriod,
  PAYOUT_PARSE_OPTIONS,
  PayoutForm,
  payoutFormSchema,
  toPayoutBody,
} from "../../lib/affiliate-payout"
import { isUnauthorized } from "../../lib/fetch-error"
import { createSingleFlight } from "../../lib/single-flight"

// spec 08 กฎ 5: กรอกตาม timezone ของเครื่องแอดมิน (ต้องตั้งเป็นเวลาไทย) — ส่ง Date เข้า API ตรงๆ
const PERIOD: { key: "period_from" | "period_to"; label: string }[] = [
  { key: "period_from", label: "From (inclusive) *" },
  { key: "period_to", label: "To (exclusive) *" },
]

/**
 * AF-12c (spec 05 กฎ 37c): FocusModal สร้าง payout — ช่วงเริ่มต้น = เดือนก่อนตามเวลาเครื่อง; 400 → toast และไม่มีแถวใหม่
 * ADM-9 (spec 08 AC-12, กฎ 5, 8, 11): Form + KeyboundForm + DatePicker; ตัวเลือก affiliate เป็น Combobox ค้นหาได้
 * ADM-17 (กฎ 21): ตัวเลือกค้นด้วย q ทีละหน้า (useComboboxData) และแสดง error ใต้ช่องเมื่อ query ล้ม
 * ADM-24 (กฎ 28): request เดียวต่อหน้า เรียงชื่อฝั่ง server; 401 → /login
 */
export const PayoutFormModal = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient()
  const form = useForm<PayoutForm>({
    resolver: zodResolver(payoutFormSchema, PAYOUT_PARSE_OPTIONS, { raw: true }),
    defaultValues: { affiliate_id: "", ...defaultPayoutPeriod(new Date()) },
  })
  const [submitOnce] = useState(createSingleFlight)
  // selectedValue: ตัวที่เลือกไว้ต้องอยู่ใน options แม้ค้นคำอื่นหรือปิด popover (label ไม่หาย)
  const options = useComboboxData({
    queryKey: [...affiliateKeys.list("affiliates"), "payout-options"],
    // spec 08 กฎ 21, 28b: ค้นด้วย q ทีละหน้า — request เดียวต่อหน้า (active + suspended) เรียงชื่อตาม API
    queryFn: listAffiliateOptions,
    getOptions: (data) =>
      data.affiliates.map((a) => ({
        value: a.id,
        label: `${a.name} (${a.email})${a.status === "suspended" ? " — suspended" : ""}`,
      })),
    selectedValue: form.watch("affiliate_id") || undefined,
  })

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

  const handleSubmit = form.handleSubmit((values) =>
    submitOnce(async () => {
      const result = toPayoutBody(values)
      if ("error" in result) {
        form.setError(result.field, { message: result.error })
        return
      }
      await save.mutateAsync(result.body).catch(() => undefined)
    })
  )

  // spec 08 กฎ 28c (แนวกฎ 24b): 401 → ErrorBoundary ของ dashboard พาไป /login; error อื่นแสดงใต้ช่อง (กฎ 21)
  if (isUnauthorized(options.error)) {
    throw options.error
  }

  return (
    <FocusModal open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <FocusModal.Content>
        <Form {...form}>
          <KeyboundForm noValidate onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  size="small"
                  type="submit"
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
                <Form.Field
                  control={form.control}
                  name="affiliate_id"
                  render={({ field: { onChange, ...field } }) => (
                    <Form.Item>
                      <Form.Label>Affiliate *</Form.Label>
                      <Form.Control>
                        <Combobox
                          {...field}
                          onChange={(id?: string) => onChange(id ?? "")}
                          placeholder={options.isLoading ? "Loading..." : "Select an affiliate"}
                          options={options.options}
                          searchValue={options.searchValue}
                          onSearchValueChange={options.onSearchValueChange}
                          fetchNextPage={options.fetchNextPage}
                          isFetchingNextPage={options.isFetchingNextPage}
                          data-testid="affiliate-payout-field-affiliate_id"
                        />
                      </Form.Control>
                      {/* กฎ 21: query ล้มต้องบอกผู้ใช้ ไม่ใช่รายการว่างเงียบ */}
                      {options.isError && (
                        <Text size="small" className="text-ui-fg-error" data-testid="affiliate-payout-options-error">
                          Could not load affiliates: {options.error.message}
                        </Text>
                      )}
                      <Form.ErrorMessage data-testid="affiliate-payout-error-affiliate_id" />
                    </Form.Item>
                  )}
                />
                {PERIOD.map(({ key, label }) => (
                  <Form.Field
                    key={key}
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <Form.Item>
                        <Form.Label>{label}</Form.Label>
                        {/* e2e กรอก/อ่านผ่าน wrapper ที่มี testid เดิม (spec 08 กฎ 7b) */}
                        <div data-testid={`affiliate-payout-field-${key}`}>
                          <Form.Control>
                            <DatePicker {...field} granularity="minute" shouldCloseOnSelect={false} />
                          </Form.Control>
                        </div>
                        <Form.ErrorMessage data-testid={`affiliate-payout-error-${key}`} />
                      </Form.Item>
                    )}
                  />
                ))}
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Includes approved entries (and their reversals) created before To that are not in another payout. From
                  is recorded as the period start.
                </Text>
              </div>
            </FocusModal.Body>
          </KeyboundForm>
        </Form>
      </FocusModal.Content>
    </FocusModal>
  )
}
