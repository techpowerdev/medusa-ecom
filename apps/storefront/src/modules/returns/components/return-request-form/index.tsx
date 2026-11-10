"use client"

import { requestReturn, ReturnRequestState } from "@lib/data/returns"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import NativeSelect from "@modules/common/components/native-select"
import { Button, Heading, Text } from "@modules/common/components/ui"
import { useActionState } from "react"

export type ReturnableLine = {
  id: string
  title: string
  variantTitle?: string | null
  maxQuantity: number
}

type Props = {
  orderId: string
  displayId?: number
  lines: ReturnableLine[]
  reasons: { id: string; label: string }[]
}

const INITIAL: ReturnRequestState = { success: false, error: null }

// spec 01 CORE-20 (AC-65): เลือก item/จำนวน/เหตุผล → POST /store/returns (server action) ปุ่มถูก disable ระหว่างส่ง
const ReturnRequestForm = ({ orderId, displayId, lines, reasons }: Props) => {
  const [state, formAction, isPending] = useActionState(requestReturn, INITIAL)
  const backHref = `/account/orders/details/${orderId}`
  // CORE-20d (กฎข้อ 66e): ส่งล้มแล้วคงจำนวน/เหตุผลที่เลือก — React 19 reset ฟอร์มกลับเป็น defaultValue หลัง action และ <select>
  // ไม่อัปเดต defaultValue หลัง mount จึง remount ฟอร์มด้วย key จากค่าที่ action คืนมา (ค่าเดิมซ้ำ = reset กลับค่าเดิม)
  const values = state.values ?? {}

  return (
    <div className="flex flex-col gap-y-6" data-testid="return-request-container">
      <Heading className="text-2xl-semi" data-testid="return-request-heading">
        ขอคืนสินค้า คำสั่งซื้อ #{displayId}
      </Heading>

      {state.success ? (
        <div className="flex flex-col gap-y-4">
          <Text className="txt-medium text-ui-fg-base" data-testid="order-return-success">
            ส่งคำขอคืนสินค้าเรียบร้อยแล้ว ร้านจะตรวจสอบคำขอและติดต่อกลับ
          </Text>
          <LocalizedClientLink href={backHref} className="underline" data-testid="back-to-order-button">
            กลับไปหน้ารายละเอียดคำสั่งซื้อ
          </LocalizedClientLink>
        </div>
      ) : !lines.length ? (
        <div className="flex flex-col gap-y-4">
          <Text className="txt-medium text-ui-fg-subtle" data-testid="return-not-available">
            คำสั่งซื้อนี้ไม่มีสินค้าที่ขอคืนได้ในขณะนี้
          </Text>
          <LocalizedClientLink href={backHref} className="underline" data-testid="back-to-order-button">
            กลับไปหน้ารายละเอียดคำสั่งซื้อ
          </LocalizedClientLink>
        </div>
      ) : (
        <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-y-4">
          <input type="hidden" name="order_id" value={orderId} />
          <Text className="txt-medium text-ui-fg-subtle" data-testid="return-request-hint">
            เลือกจำนวนสินค้าที่ต้องการคืนและเหตุผล
          </Text>
          <ul className="flex flex-col gap-y-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-col small:flex-row small:items-center gap-4 border-b border-ui-border-base pb-4"
                data-testid="return-item"
                data-line-id={line.id}
              >
                <div className="flex-1">
                  <Text className="txt-medium-plus" data-testid="return-item-title">
                    {line.title}
                  </Text>
                  {line.variantTitle && (
                    <Text className="txt-small text-ui-fg-subtle">{line.variantTitle}</Text>
                  )}
                </div>
                <label className="flex flex-col gap-y-1 txt-small">
                  <span>จำนวนที่คืน</span>
                  <NativeSelect
                    name={`quantity:${line.id}`}
                    defaultValue={values[`quantity:${line.id}`] ?? "0"}
                    placeholder="จำนวน"
                    data-testid="return-item-quantity"
                  >
                    {Array.from({ length: line.maxQuantity + 1 }, (_, n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                {reasons.length > 0 && (
                  <label className="flex flex-col gap-y-1 txt-small">
                    <span>เหตุผล</span>
                    <NativeSelect
                      name={`reason:${line.id}`}
                      defaultValue={values[`reason:${line.id}`] ?? ""}
                      placeholder="เลือกเหตุผล"
                      className="min-w-[12rem]"
                      data-testid="return-item-reason"
                    >
                      {reasons.map((reason) => (
                        <option key={reason.id} value={reason.id}>
                          {reason.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </li>
            ))}
          </ul>
          {state.error && (
            <Text className="txt-medium text-rose-500" data-testid="return-error">
              {state.error}
            </Text>
          )}
          <div className="flex gap-x-4 items-center">
            <Button type="submit" disabled={isPending} isLoading={isPending} data-testid="return-submit-button">
              ยืนยันขอคืนสินค้า
            </Button>
            <LocalizedClientLink href={backHref} className="text-ui-fg-subtle" data-testid="back-to-order-button">
              ยกเลิก
            </LocalizedClientLink>
          </div>
        </form>
      )}
    </div>
  )
}

export default ReturnRequestForm
