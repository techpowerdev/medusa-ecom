"use client"

import { requestReturn, ReturnRequestState } from "@lib/data/returns"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import NativeSelect from "@modules/common/components/native-select"
import { Button } from "@/components/button"
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
      <h2 className="text-2xl font-semibold" data-testid="return-request-heading">
        ขอคืนสินค้า คำสั่งซื้อ #{displayId}
      </h2>

      {state.success ? (
        <div className="flex flex-col gap-y-4">
          <p className="text-sm leading-[1.4rem] text-foreground" data-testid="order-return-success">
            ส่งคำขอคืนสินค้าเรียบร้อยแล้ว ร้านจะตรวจสอบคำขอและติดต่อกลับ
          </p>
          <LocalizedClientLink href={backHref} className="underline" data-testid="back-to-order-button">
            กลับไปหน้ารายละเอียดคำสั่งซื้อ
          </LocalizedClientLink>
        </div>
      ) : !lines.length ? (
        <div className="flex flex-col gap-y-4">
          <p className="text-sm leading-[1.4rem] text-muted-foreground" data-testid="return-not-available">
            คำสั่งซื้อนี้ไม่มีสินค้าที่ขอคืนได้ในขณะนี้
          </p>
          <LocalizedClientLink href={backHref} className="underline" data-testid="back-to-order-button">
            กลับไปหน้ารายละเอียดคำสั่งซื้อ
          </LocalizedClientLink>
        </div>
      ) : (
        <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-y-4">
          <input type="hidden" name="order_id" value={orderId} />
          <p className="text-sm leading-[1.4rem] text-muted-foreground" data-testid="return-request-hint">
            เลือกจำนวนสินค้าที่ต้องการคืนและเหตุผล
          </p>
          <ul className="flex flex-col gap-y-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-col small:flex-row small:items-center gap-4 border-b border-border pb-4"
                data-testid="return-item"
                data-line-id={line.id}
              >
                <div className="flex-1">
                  <p className="text-sm leading-[1.4rem] font-medium" data-testid="return-item-title">
                    {line.title}
                  </p>
                  {line.variantTitle && (
                    <p className="text-sm leading-[1.4rem] text-muted-foreground">{line.variantTitle}</p>
                  )}
                </div>
                {/* SFUI-12c (spec 09 กฎ 28–29, 31a): label เหนือช่องของ field — id จาก useId จึงไม่ซ้ำต่อแถว; option เดิม (รวม option ว่าง)
                    w-auto = ความกว้างตามเนื้อหาในแถว small:flex-row เท่า <label> เดิม (Field เป็น w-full) */}
                <NativeSelect
                  label="จำนวนที่คืน"
                  name={`quantity:${line.id}`}
                  defaultValue={values[`quantity:${line.id}`] ?? "0"}
                  placeholder="จำนวน"
                  className="w-auto"
                  data-testid="return-item-quantity"
                >
                  {Array.from({ length: line.maxQuantity + 1 }, (_, n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
                {reasons.length > 0 && (
                  <NativeSelect
                    label="เหตุผล"
                    name={`reason:${line.id}`}
                    defaultValue={values[`reason:${line.id}`] ?? ""}
                    placeholder="เลือกเหตุผล"
                    className="w-auto min-w-[12rem]"
                    data-testid="return-item-reason"
                  >
                    {reasons.map((reason) => (
                      <option key={reason.id} value={reason.id}>
                        {reason.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </li>
            ))}
          </ul>
          {state.contactStore ? (
            // CORE-71 (กฎข้อ 129): location ไม่มีของ — ลองใหม่ไม่ช่วย ให้ติดต่อร้าน
            <p className="text-sm leading-[1.4rem] text-rose-500" data-testid="return-contact-store">
              {state.error}{" "}
              <LocalizedClientLink href="/contact" className="underline" data-testid="return-contact-store-link">
                ไปหน้าติดต่อร้าน
              </LocalizedClientLink>
            </p>
          ) : (
            state.error && (
              <p className="text-sm leading-[1.4rem] text-rose-500" data-testid="return-error">
                {state.error}
              </p>
            )
          )}
          <div className="flex gap-x-4 items-center">
            <Button type="submit" disabled={isPending} isLoading={isPending} data-testid="return-submit-button">
              ยืนยันขอคืนสินค้า
            </Button>
            <LocalizedClientLink href={backHref} className="text-muted-foreground" data-testid="back-to-order-button">
              ยกเลิก
            </LocalizedClientLink>
          </div>
        </form>
      )}
    </div>
  )
}

export default ReturnRequestForm
