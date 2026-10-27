import { confirmPendingAdd } from "@lib/data/customer"
import { retrieveVariant } from "@lib/data/products"
import { canPurchaseVariant } from "@lib/util/inventory"
import { convertToLocale } from "@lib/util/money"
import {
  PENDING_ADD_PARAM,
  PENDING_QUANTITY_PARAM,
  readPendingAddQuery,
} from "@lib/util/pending-add-to-cart"
import { SubmitButton } from "@modules/checkout/components/submit-button"

type Props = {
  countryCode: string
  searchParams: Record<string, string | string[] | undefined> | undefined
  /** CORE-14d (กฎ 58): ลูกค้าล็อกอินอยู่แล้ว → แสดงปุ่มยืนยันเมื่อ variant ขายได้ */
  confirm?: boolean
}

// CORE-14b (กฎ 26, AC-45): `add_variant` ที่ไม่มีอยู่จริง/ขายไม่ได้ต้องแสดง error ไม่เงียบ
// ตรวจฝั่ง server เพื่อให้อยู่ใน HTML แม้ไม่มี JavaScript; หน้านี้ไม่แก้ cart (GET ไม่มี side effect)
// CORE-14d (กฎ 58, owner 2026-10-27): ล็อกอินอยู่แล้ว → ไม่เพิ่มเอง แสดงสินค้า + ปุ่มยืนยัน (ฟอร์ม POST ใช้ได้แม้ปิด JS;
// SubmitButton disable ระหว่างส่งกันกดซ้ำ)
const AddVariantError = async ({ countryCode, searchParams, confirm }: Props) => {
  const pending = readPendingAddQuery(searchParams)
  if (!pending) {
    return null
  }

  // add_error = เพิ่มลง cart หลัง login ล้มไปแล้ว (เช่น variant ถูกลบระหว่างทาง) → แสดง error เสมอ
  const variant = pending.failed
    ? null
    : await retrieveVariant(pending.variantId, countryCode)

  if (variant && canPurchaseVariant(variant, pending.quantity)) {
    if (!confirm) {
      return null
    }
    const price = variant.calculated_price
    return (
      <form
        action={confirmPendingAdd}
        className="mb-6 flex flex-col gap-4 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4 small:flex-row small:items-center small:justify-between"
        data-testid="add-variant-pending"
      >
        <input type="hidden" name={PENDING_ADD_PARAM} value={pending.variantId} />
        <input type="hidden" name={PENDING_QUANTITY_PARAM} value={pending.quantity} />
        <input type="hidden" name="country_code" value={countryCode} />
        <p className="text-base-regular text-ui-fg-base">
          สินค้าที่เลือกไว้{variant.title ? ` (ตัวเลือก ${variant.title})` : ""} จำนวน{" "}
          {pending.quantity} ชิ้น
          {price?.calculated_amount != null &&
            ` ราคาชิ้นละ ${convertToLocale({
              amount: price.calculated_amount,
              currency_code: price.currency_code ?? "",
            })}`}{" "}
          ยังไม่ได้อยู่ในตะกร้า
        </p>
        <SubmitButton data-testid="add-variant-confirm">เพิ่มลงตะกร้า</SubmitButton>
      </form>
    )
  }

  return (
    <div
      role="alert"
      className="mb-6 rounded-rounded border border-ui-border-error bg-ui-bg-subtle p-4 text-base-regular text-ui-fg-error"
      data-testid="add-variant-error"
    >
      เพิ่มสินค้าลงตะกร้าไม่สำเร็จ สินค้าที่เลือกอาจไม่มีอยู่ หมดแล้ว
      หรือมีไม่พอตามจำนวนที่ต้องการ
    </div>
  )
}

export default AddVariantError
