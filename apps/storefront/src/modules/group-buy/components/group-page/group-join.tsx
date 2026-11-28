"use client"

import { setShippingMethod } from "@lib/data/cart"
import { joinGroupBuy, prepareGroupCart, type GroupCart } from "@lib/data/group-join"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { syncAffiliateBefore } from "@lib/util/checkout-affiliate"
import { groupJoinActionMessage } from "@lib/util/group-join-error"
import { addressLines } from "@lib/util/address-lines"
import { loginPathForReturn } from "@lib/util/login-return"
import {
  addToSelection,
  removeFromSelection,
  selectionUnits,
  setSelectionQuantity,
  type GroupSelectionItem,
} from "@lib/util/group-page"
import { convertToLocale } from "@lib/util/money"
import { PDP_QUANTITY_OPTIONS } from "@lib/util/pending-add-to-cart"
import { findVariantByOptions } from "@lib/util/product-variant-options"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { useParams, useRouter } from "next/navigation"
import { useId, useRef, useState } from "react"
import GroupSelectionInfo from "./group-selection-info"

import { Button } from "@/components/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import ErrorMessage from "@modules/checkout/components/error-message"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Props = {
  token: string
  product: HttpTypes.StoreProduct
  /** ที่อยู่ที่บันทึกไว้ของลูกค้า; null = ยังไม่ login (กด join → หน้า login, กฎข้อ 29e) */
  addresses: HttpTypes.StoreCustomerAddress[] | null
  maxUnitsPerPerson: number | null
  /** กฎข้อ 29e: กลุ่ม open และยังไม่เลย ends_at — false → ซ่อนฟอร์ม/ปุ่มแต่คง error ของ join ไว้ (qa #238 D2) */
  joinable: boolean
}

const PREPARE_FAILED = "เตรียมรายการไม่สำเร็จ กรุณาลองใหม่"
const NO_SHIPPING = "ไม่มีวิธีจัดส่งสำหรับที่อยู่นี้ กรุณาเลือกที่อยู่อื่น"
const JOIN_FAILED = "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่"

// SFUI-18a (spec 09 กฎ 57): ชื่อ + บรรทัดที่อยู่ตามลำดับไทย
const addressLabel = (a: HttpTypes.StoreCustomerAddress) =>
  [a.first_name, a.last_name, addressLines(a)[0]].filter(Boolean).join(" ")

// GB-7a2 (spec 04 กฎข้อ 29c–f, 31): เลือกหลาย variant + ที่อยู่ → cart ใหม่ (c1) → วิธีส่ง → sync aff → join (c2)
// cart ปัจจุบัน (`_medusa_cart_id`) ไม่ถูกอ่าน/แก้ (กฎข้อ 14c); action ที่สร้างข้อมูลกันกดซ้ำด้วย ref (in-flight) + disabled
export default function GroupJoin({ token, product, addresses, maxUnitsPerPerson, joinable }: Props) {
  const router = useRouter()
  const id = useId()
  const countryCode = useParams().countryCode as string
  const inFlight = useRef(false)
  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [quantity, setQuantity] = useState(1)
  const [selection, setSelection] = useState<GroupSelectionItem[]>([])
  const [addressId, setAddressId] = useState(addresses?.[0]?.id ?? "")
  const [prepared, setPrepared] = useState<GroupCart | null>(null)
  const [shippingId, setShippingId] = useState("")
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const variant = findVariantByOptions(product.variants, options)
  const units = selectionUnits(selection)
  const overLimit = !!maxUnitsPerPerson && units > maxUnitsPerPerson
  const variantTitle = (id: string) => product.variants?.find((v) => v.id === id)?.title ?? id
  const noShipping = !!prepared && prepared.shipping_options.length === 0
  const shippingLabel = (o: GroupCart["shipping_options"][number]) =>
    `${o.name} — ${convertToLocale({ amount: o.amount, currency_code: prepared!.currency_code })}`
  const selectedAddress = addresses?.find((a) => a.id === addressId)
  const selectedShipping = prepared?.shipping_options.find((o) => o.id === shippingId)

  // รายการหรือที่อยู่เปลี่ยน → cart ที่เตรียมไว้ใช้ไม่ได้แล้ว เริ่ม (c1) ใหม่ด้วย cart ใหม่ (ไม่แก้ cart เดิมซ้ำ)
  const updateSelection = (next: GroupSelectionItem[]) => {
    setSelection(next)
    setPrepared(null)
    setShippingId("")
  }

  const run = async (task: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await task()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const prepare = () =>
    run(async () => {
      const result = await settleAction(prepareGroupCart({ countryCode, addressId, items: selection }))
      if ("error" in result) {
        setError(actionErrorMessage(result.error, PREPARE_FAILED))
        return
      }
      // qa #238 D1: ไม่เลือกวิธีส่งให้ (ตัวแรกอาจเป็น Digital delivery ฿0 — spec 02 กฎ 8) ลูกค้าต้องเลือกเอง
      setPrepared(result)
      setShippingId("")
    })

  const join = () =>
    run(async () => {
      if (!prepared || !shippingId || joined) return
      // CORE-4i-b (spec 01 กฎข้อ 72): setShippingMethod คืนผลแทนการ throw
      const shipped = await settleAction(setShippingMethod({ cartId: prepared.cart.id, shippingMethodId: shippingId }))
      if ("error" in shipped) {
        setError(actionErrorMessage(shipped.error, JOIN_FAILED))
        return
      }
      // กฎข้อ 27: sync cookie `aff` ลง cart ใหม่ก่อน join (static test ของ spec 05 กฎ 31 ตรวจจุดนี้)
      const result = await settleAction(syncAffiliateBefore(prepared.cart, () => joinGroupBuy(token, prepared.cart.id)))
      if ("error" in result) {
        setError(groupJoinActionMessage(result.error, { maxUnitsPerPerson }))
        return
      }
      // สำเร็จ → คง disabled ไว้ระหว่างเปลี่ยนหน้า (cart นี้ join แล้ว) แล้วไปหน้ารายการกลุ่มของ GB-7b
      setJoined(true)
      router.push(`/${countryCode}/account/orders`)
    })

  // CORE-30 (spec 01 กฎข้อ 87): ยังไม่ login → หน้า login แล้วกลับหน้ากลุ่มนี้ (ลูกค้ากด join เองอีกครั้ง)
  const goLogin = () => router.push(loginPathForReturn(countryCode, `/${countryCode}/g/${encodeURIComponent(token)}`))

  // หน้า render ใหม่หลัง server action (เช่น setShippingMethod) ตอนกลุ่มหมดเวลา → ซ่อนฟอร์มแต่ยังแสดงผลของ join ที่ล้ม
  if (!joinable) {
    // SFUI-21d (spec 09 กฎ 74 (a)): error ของการกระทำ join = Alert ผ่าน ErrorMessage
    return <ErrorMessage error={error} data-testid="group-join-error" />
  }

  return (
    <section className="flex flex-col gap-y-4 rounded-rounded border border-border p-4" data-testid="group-join">
      <h2 className="text-base leading-6 font-semibold">เลือกสินค้าที่ต้องการ</h2>
      <div className="flex flex-col gap-y-4" data-testid="group-options">
        {(product.options ?? []).map((option) => (
          <OptionSelect
            key={option.id}
            option={option}
            current={options[option.id]}
            updateOption={(id, value) => setOptions((prev) => ({ ...prev, [id]: value }))}
            title={option.title ?? ""}
            name={`group-option-${option.id}`}
            disabled={busy}
          />
        ))}
      </div>
      <div className="flex items-end gap-x-3">
        {/* SFUI-16a (spec 09 กฎ 40b–41; ADR-033): select ของ shadcn ประกอบตามตัวอย่าง docs (controlled) — มีค่าเสมอ ไม่มี placeholder
            w-auto = กว้างตามเนื้อหาข้างปุ่มเพิ่มในรายการ (Field เป็น w-full) */}
        <Field className="w-auto">
          <FieldLabel htmlFor={`${id}-quantity`} data-testid="group-quantity-label">
            จำนวน
          </FieldLabel>
          <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v))}>
            <SelectTrigger id={`${id}-quantity`} data-testid="group-quantity" data-value={String(quantity)}>
              <SelectValue>{quantity}</SelectValue>
            </SelectTrigger>
            <SelectContent data-testid="group-quantity-options">
              {PDP_QUANTITY_OPTIONS.map((q) => (
                <SelectItem key={q} value={String(q)} data-testid="group-quantity-option" data-value={String(q)}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="outline"
          disabled={!variant || busy}
          onClick={() => variant && updateSelection(addToSelection(selection, variant.id, quantity))}
          data-testid="group-add-variant"
        >
          เพิ่มในรายการ
        </Button>
      </div>

      {selection.length > 0 && (
        <ul className="flex flex-col gap-y-2" data-testid="group-selection">
          {selection.map((item) => (
            <li key={item.variant_id} className="flex items-center gap-x-3" data-testid="group-selection-item">
              <GroupSelectionInfo product={product} variantId={item.variant_id} />
              <input
                type="number"
                min={1}
                value={item.quantity}
                aria-label={`จำนวน ${variantTitle(item.variant_id)}`}
                onChange={(e) => updateSelection(setSelectionQuantity(selection, item.variant_id, e.target.value))}
                className="w-20 rounded-md border border-border px-2 py-1"
                disabled={busy}
                data-testid="group-selection-quantity"
              />
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => updateSelection(removeFromSelection(selection, item.variant_id))}
                data-testid="group-selection-remove"
              >
                ลบ
              </Button>
            </li>
          ))}
        </ul>
      )}
      {overLimit && (
        // SFUI-21d (spec 09 กฎ 74 (b)): ข้อความใต้รายการที่เลือก = FieldError (inline)
        <FieldError data-testid="group-units-limit">
          เลือกได้สูงสุด {maxUnitsPerPerson} ชิ้นต่อคน (เลือกแล้ว {units} ชิ้น)
        </FieldError>
      )}

      {addresses && addresses.length === 0 && (
        <p className="text-xs leading-5 font-normal">
          ยังไม่มีที่อยู่สำหรับจัดส่ง{" "}
          <LocalizedClientLink href="/account/addresses" className="underline" data-testid="group-add-address-link">
            เพิ่มที่อยู่
          </LocalizedClientLink>
        </p>
      )}
      {addresses && addresses.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <Field>
            <FieldLabel htmlFor={`${id}-address`} data-testid="group-address-select-label">
              ที่อยู่จัดส่ง
            </FieldLabel>
            <Select
              value={addressId}
              onValueChange={(v) => {
                setAddressId(v)
                updateSelection(selection)
              }}
              disabled={busy}
            >
              <SelectTrigger id={`${id}-address`} data-testid="group-address-select" data-value={addressId} className="w-full">
                <SelectValue>{selectedAddress && addressLabel(selectedAddress)}</SelectValue>
              </SelectTrigger>
              <SelectContent data-testid="group-address-select-options">
                {addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id} data-testid="group-address-select-option" data-value={a.id}>
                    {addressLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!prepared && (
            <Button
              variant="outline"
              className="self-start"
              disabled={!selection.length || overLimit || busy}
              onClick={prepare}
              data-testid="group-shipping-load"
            >
              เลือกวิธีจัดส่ง
            </Button>
          )}
        </div>
      )}

      {prepared && !noShipping && (
        // ค่า "" = ยังไม่เลือก แสดง placeholder (กฎ 41) — ลูกค้าต้องเลือกเอง (qa #238 D1)
        <Field>
          <FieldLabel htmlFor={`${id}-shipping`} data-testid="group-shipping-option-label">
            วิธีจัดส่ง
          </FieldLabel>
          <Select value={shippingId} onValueChange={setShippingId} disabled={busy}>
            <SelectTrigger id={`${id}-shipping`} data-testid="group-shipping-option" data-value={shippingId} className="w-full">
              <SelectValue placeholder="เลือกวิธีจัดส่ง">{selectedShipping && shippingLabel(selectedShipping)}</SelectValue>
            </SelectTrigger>
            <SelectContent data-testid="group-shipping-option-options">
              {prepared.shipping_options.map((o) => (
                <SelectItem key={o.id} value={o.id} data-testid="group-shipping-option-option" data-value={o.id}>
                  {shippingLabel(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <ErrorMessage error={error || noShipping ? (error ?? NO_SHIPPING) : null} data-testid="group-join-error" />

      {!noShipping && (
        <Button
          className="w-full"
          isLoading={busy || joined}
          disabled={addresses !== null && (!prepared || !shippingId || overLimit)}
          onClick={addresses === null ? goLogin : join}
          data-testid="group-join-button"
        >
          เข้าร่วมกลุ่ม
        </Button>
      )}
    </section>
  )
}
