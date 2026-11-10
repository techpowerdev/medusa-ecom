/**
 * FS-15 (spec 03 กฎข้อ 20b, AC-21): line ที่ได้ราคา flash แต่จำนวนเกิน `remaining_units` ของแคมเปญ — เตือนอย่างเดียว ไม่บล็อกการแก้จำนวน
 * (complete จะล้มด้วย FLASH_SOLD_OUT ถ้าไม่ลดจำนวน)
 */
export default function CartFlashExceedsRemaining({
  remaining,
}: {
  remaining?: number
}) {
  if (remaining == null) {
    return null
  }
  return (
    <p
      className="txt-small text-ui-fg-error w-full"
      data-testid="cart-flash-exceeds-remaining"
    >
      {remaining > 0
        ? `ราคาแฟลชเซลเหลือเพียง ${remaining} ชิ้น กรุณาลดจำนวนก่อนสั่งซื้อ`
        : "สินค้าแฟลชเซลนี้ขายครบจำนวนแล้ว กรุณาลบออกก่อนสั่งซื้อ"}
    </p>
  )
}
