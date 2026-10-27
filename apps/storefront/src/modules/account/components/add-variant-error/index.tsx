import { retrieveVariant } from "@lib/data/products"
import { canPurchaseVariant } from "@lib/util/inventory"
import { readPendingAddQuery } from "@lib/util/pending-add-to-cart"

type Props = {
  countryCode: string
  searchParams: Record<string, string | string[] | undefined> | undefined
}

// CORE-14b (กฎ 26, AC-45): `add_variant` ที่ไม่มีอยู่จริง/ขายไม่ได้ต้องแสดง error ไม่เงียบ
// ตรวจฝั่ง server เพื่อให้อยู่ใน HTML แม้ไม่มี JavaScript; หน้านี้ไม่แก้ cart (GET ไม่มี side effect)
const AddVariantError = async ({ countryCode, searchParams }: Props) => {
  const pending = readPendingAddQuery(searchParams)
  if (!pending) {
    return null
  }

  const variant = await retrieveVariant(pending.variantId, countryCode)
  if (canPurchaseVariant(variant, pending.quantity)) {
    return null
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
