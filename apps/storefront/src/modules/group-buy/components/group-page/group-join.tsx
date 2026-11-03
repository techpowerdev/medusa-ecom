"use client"

import { setShippingMethod } from "@lib/data/cart"
import { joinGroupBuy, prepareGroupCart, type GroupCart } from "@lib/data/group-join"
import { actionErrorMessage, settleAction } from "@lib/util/action-result"
import { syncAffiliateBefore } from "@lib/util/checkout-affiliate"
import { groupJoinActionMessage } from "@lib/util/group-join-error"
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
import { Button } from "@modules/common/components/ui"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { useParams, useRouter } from "next/navigation"
import { useRef, useState } from "react"

type Props = {
  token: string
  product: HttpTypes.StoreProduct
  /** ที่อยู่ที่บันทึกไว้ของลูกค้า; null = ยังไม่ login (กด join → หน้า login, กฎข้อ 29e) */
  addresses: HttpTypes.StoreCustomerAddress[] | null
  maxUnitsPerPerson: number | null
}

const PREPARE_FAILED = "เตรียมรายการไม่สำเร็จ กรุณาลองใหม่"
const NO_SHIPPING = "ไม่มีวิธีจัดส่งสำหรับที่อยู่นี้ กรุณาเลือกที่อยู่อื่น"
const JOIN_FAILED = "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่"

const addressLabel = (a: HttpTypes.StoreCustomerAddress) =>
  [a.first_name, a.last_name, a.address_1, a.city, a.postal_code].filter(Boolean).join(" ")

// GB-7a2 (spec 04 กฎข้อ 29c–f, 31): เลือกหลาย variant + ที่อยู่ → cart ใหม่ (c1) → วิธีส่ง → sync aff → join (c2)
// cart ปัจจุบัน (`_medusa_cart_id`) ไม่ถูกอ่าน/แก้ (กฎข้อ 14c); action ที่สร้างข้อมูลกันกดซ้ำด้วย ref (in-flight) + disabled
export default function GroupJoin({ token, product, addresses, maxUnitsPerPerson }: Props) {
  const router = useRouter()
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
      setPrepared(result)
      setShippingId(result.shipping_options[0]?.id ?? "")
    })

  const join = () =>
    run(async () => {
      if (!prepared || !shippingId || joined) return
      try {
        await setShippingMethod({ cartId: prepared.cart.id, shippingMethodId: shippingId })
      } catch {
        setError(JOIN_FAILED)
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

  return (
    <section className="flex flex-col gap-y-4 rounded-rounded border border-ui-border-base p-4" data-testid="group-join">
      <h2 className="text-large-semi">เลือกสินค้าที่ต้องการ</h2>
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
        <label className="flex flex-col gap-y-1 text-small-regular">
          จำนวน
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-1.5"
            data-testid="group-quantity"
          >
            {PDP_QUANTITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
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
              <span className="min-w-0 flex-1 break-words">{variantTitle(item.variant_id)}</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
                aria-label={`จำนวน ${variantTitle(item.variant_id)}`}
                onChange={(e) => updateSelection(setSelectionQuantity(selection, item.variant_id, e.target.value))}
                className="w-20 rounded-md border border-ui-border-base px-2 py-1"
                disabled={busy}
                data-testid="group-selection-quantity"
              />
              <Button
                variant="transparent"
                size="small"
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
        <p className="text-small-regular text-rose-500" data-testid="group-units-limit">
          เลือกได้สูงสุด {maxUnitsPerPerson} ชิ้นต่อคน (เลือกแล้ว {units} ชิ้น)
        </p>
      )}

      {addresses && addresses.length === 0 && (
        <p className="text-small-regular">
          ยังไม่มีที่อยู่สำหรับจัดส่ง{" "}
          <LocalizedClientLink href="/account/addresses" className="underline" data-testid="group-add-address-link">
            เพิ่มที่อยู่
          </LocalizedClientLink>
        </p>
      )}
      {addresses && addresses.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <label className="flex flex-col gap-y-1 text-small-regular">
            ที่อยู่จัดส่ง
            <select
              value={addressId}
              onChange={(e) => {
                setAddressId(e.target.value)
                updateSelection(selection)
              }}
              disabled={busy}
              className="rounded-md border border-ui-border-base px-3 py-1.5"
              data-testid="group-address-select"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {addressLabel(a)}
                </option>
              ))}
            </select>
          </label>
          {!prepared && (
            <Button
              variant="secondary"
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
        <label className="flex flex-col gap-y-1 text-small-regular">
          วิธีจัดส่ง
          <select
            value={shippingId}
            onChange={(e) => setShippingId(e.target.value)}
            disabled={busy}
            className="rounded-md border border-ui-border-base px-3 py-1.5"
            data-testid="group-shipping-option"
          >
            {prepared.shipping_options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} — {convertToLocale({ amount: o.amount, currency_code: prepared.currency_code })}
              </option>
            ))}
          </select>
        </label>
      )}

      {(error || noShipping) && (
        <p className="text-small-regular text-rose-500" role="alert" data-testid="group-join-error">
          {error ?? NO_SHIPPING}
        </p>
      )}

      {!noShipping && (
        <Button
          className="w-full"
          isLoading={busy || joined}
          disabled={addresses !== null && (!prepared || !shippingId || overLimit)}
          onClick={addresses === null ? () => router.push(`/${countryCode}/account`) : join}
          data-testid="group-join-button"
        >
          เข้าร่วมกลุ่ม
        </Button>
      )}
    </section>
  )
}
