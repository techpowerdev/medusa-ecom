"use client"

import { requestReturn, ReturnRequestState } from "@lib/data/returns"
import ErrorMessage from "@modules/checkout/components/error-message"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Button } from "@/components/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActionState, useId, useState } from "react"

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

/**
 * SFUI-16a (spec 09 กฎ 40b–41; ADR-033): ช่องจำนวน/เหตุผลของหนึ่งแถว — select ของ shadcn ประกอบตามตัวอย่าง docs; แยกเป็น component ของแถวเพราะต้องใช้ hook ต่อแถว
 * (`useId` สำหรับ id ของ trigger และ state ของค่าปัจจุบัน) — แบบ uncontrolled (`defaultValue` + `name`) ที่เก็บค่าจาก `onValueChange` เพื่อแสดงข้อความ/`data-value`
 * ให้ตรงค่าใน FormData; form reset ของ React 19 → Radix ตั้งค่ากลับเป็น defaultValue และเรียก onValueChange (state ตาม) ส่วน remount ด้วย key → state เริ่มใหม่จาก values
 */
function ReturnItemFields({
  line,
  reasons,
  values,
}: {
  line: ReturnableLine
  reasons: Props["reasons"]
  values: Record<string, string>
}) {
  const id = useId()
  const quantityName = `quantity:${line.id}`
  const reasonName = `reason:${line.id}`
  const [quantity, setQuantity] = useState(values[quantityName] ?? "0")
  const [reason, setReason] = useState(values[reasonName] ?? "")

  return (
    <>
      {/* label เหนือช่อง (กฎ 28–29); w-auto = กว้างตามเนื้อหาในแถว small:flex-row (Field เป็น w-full) */}
      <Field className="w-auto">
        <FieldLabel htmlFor={`${id}-quantity`} data-testid="return-item-quantity-label">
          จำนวนที่คืน
        </FieldLabel>
        <Select name={quantityName} defaultValue={values[quantityName] ?? "0"} onValueChange={setQuantity}>
          <SelectTrigger id={`${id}-quantity`} data-testid="return-item-quantity" data-value={quantity}>
            {/* ค่าเริ่ม "0" จึงไม่แสดง placeholder จริง — คงข้อความเดิมไว้ตามกฎ 41 */}
            <SelectValue placeholder="จำนวน">{quantity}</SelectValue>
          </SelectTrigger>
          <SelectContent data-testid="return-item-quantity-options">
            {Array.from({ length: line.maxQuantity + 1 }, (_, n) => (
              <SelectItem key={n} value={String(n)} data-testid="return-item-quantity-option" data-value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {reasons.length > 0 && (
        <Field className="w-auto min-w-[12rem]">
          <FieldLabel htmlFor={`${id}-reason`} data-testid="return-item-reason-label">
            เหตุผล
          </FieldLabel>
          <Select name={reasonName} defaultValue={values[reasonName] ?? ""} onValueChange={setReason}>
            <SelectTrigger id={`${id}-reason`} data-testid="return-item-reason" data-value={reason} className="w-full">
              <SelectValue placeholder="เลือกเหตุผล">{reasons.find((r) => r.id === reason)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent data-testid="return-item-reason-options">
              {reasons.map((r) => (
                <SelectItem key={r.id} value={r.id} data-testid="return-item-reason-option" data-value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  )
}

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
                <ReturnItemFields line={line} reasons={reasons} values={values} />
              </li>
            ))}
          </ul>
          {/* SFUI-21d (spec 09 กฎ 74 (a)): error ของฟอร์มขอคืน = Alert ผ่าน ErrorMessage */}
          {state.contactStore ? (
            // CORE-71 (กฎข้อ 129): location ไม่มีของ — ลองใหม่ไม่ช่วย ให้ติดต่อร้าน (ลิงก์อยู่ใน AlertDescription)
            <ErrorMessage
              data-testid="return-contact-store"
              error={
                <span>
                  {state.error}{" "}
                  <LocalizedClientLink href="/contact" className="underline" data-testid="return-contact-store-link">
                    ไปหน้าติดต่อร้าน
                  </LocalizedClientLink>
                </span>
              }
            />
          ) : (
            <ErrorMessage error={state.error} data-testid="return-error" />
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
