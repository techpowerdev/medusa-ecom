import { selectionVariantInfo } from "@lib/util/group-page"
import { HttpTypes } from "@medusajs/types"

// GB-12 (spec 04 กฎข้อ 32b): ชื่อสินค้า + variant และราคาต่อชิ้นของแถวใน `group-selection` — ส่วนลดกลุ่มเกิดเมื่อกลุ่มสำเร็จ
// แยกจาก group-join.tsx เพื่อให้ไฟล์นั้นเปลี่ยนน้อยที่สุด (CORE-30 แก้ไฟล์เดียวกัน)
export default function GroupSelectionInfo({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId: string
}) {
  const { title, amount, price } = selectionVariantInfo(product, variantId)
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="break-words" data-testid="group-selection-title">
        {title}
      </span>
      {price && (
        <span
          className="text-small-regular text-ui-fg-subtle"
          data-testid="group-selection-price"
          data-value={amount ?? undefined}
        >
          {price} ต่อชิ้น (ราคาก่อนส่วนลดกลุ่ม)
        </span>
      )}
    </div>
  )
}
