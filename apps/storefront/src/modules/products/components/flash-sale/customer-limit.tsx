import type { PdpCustomerLimit } from "@lib/util/flash-allowance"

/**
 * FS-21 (spec 03 กฎข้อ 26a, AC-28 a/b): สิทธิ์ราคาแฟลชเซลต่อคนของ variant ที่เลือก
 * ใช้สิทธิ์ครบแล้ว → ข้อความเพิ่ม ผู้เรียก disable ปุ่มเพิ่มลงตะกร้า
 * FS-23 (กฎข้อ 28b/c): ไม่รู้สิทธิ์ของลูกค้า (ไม่ login) → แสดงเฉพาะ limit; สิทธิ์ที่เหลือหักของในตะกร้าแล้ว
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
        จำกัด {limit.limit} ชิ้นต่อคน
        {limit.remaining != null && ` (เหลือสิทธิ์ ${limit.remaining} ชิ้น)`}
      </p>
      {limit.remaining === 0 && (
        <p
          className="text-small-regular text-destructive"
          role="alert"
          data-testid="flash-customer-limit-reached"
        >
          {limit.in_cart > 0
            ? "สิทธิ์ราคาแฟลชเซลที่เหลือของคุณอยู่ในตะกร้าแล้ว"
            : "คุณใช้สิทธิ์ราคาแฟลชเซลครบแล้ว"}
        </p>
      )}
    </>
  )
}
