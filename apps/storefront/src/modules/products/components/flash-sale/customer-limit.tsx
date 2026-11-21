import type { PdpCustomerLimit } from "@lib/util/flash-allowance"

/**
 * FS-21 (spec 03 กฎข้อ 26a, AC-28 a/b): สิทธิ์ราคาแฟลชเซลต่อคนของ variant ที่เลือก (ลูกค้าที่ login เท่านั้น)
 * ใช้สิทธิ์ครบแล้ว → ข้อความเพิ่ม ผู้เรียก disable ปุ่มเพิ่มลงตะกร้า
 */
export default function FlashCustomerLimit({
  limit,
}: {
  limit: PdpCustomerLimit | null
}) {
  if (!limit) {
    return null
  }
  return (
    <>
      <p className="text-small-regular" data-testid="flash-customer-limit">
        จำกัด {limit.limit} ชิ้นต่อคน (เหลือสิทธิ์ {limit.remaining} ชิ้น)
      </p>
      {limit.remaining === 0 && (
        <p
          className="text-small-regular text-ui-fg-error"
          role="alert"
          data-testid="flash-customer-limit-reached"
        >
          คุณใช้สิทธิ์ราคาแฟลชเซลครบแล้ว
        </p>
      )}
    </>
  )
}
