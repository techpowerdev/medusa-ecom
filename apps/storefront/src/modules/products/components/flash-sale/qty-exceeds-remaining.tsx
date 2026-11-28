import { FieldError } from "@/components/ui/field"

/**
 * FS-15 (spec 03 กฎข้อ 20a, AC-21): จำนวนที่เลือกบน PDP เกินโควตาที่เหลือของแคมเปญ flash — ผู้เรียก disable ปุ่มเพิ่มลงตะกร้าด้วย
 * `remaining` มาจาก `flashQtyExceeded` (null = ไม่เกิน ไม่แสดง)
 */
export default function FlashQtyExceedsRemaining({
  remaining,
}: {
  remaining: number | null
}) {
  if (remaining == null) {
    return null
  }
  return (
    // SFUI-21e (spec 09 กฎ 74 (b)): ข้อความผูกตัวเลือกจำนวน = FieldError (inline)
    <FieldError data-testid="flash-qty-exceeds-remaining">
      ราคาแฟลชเซลเหลือเพียง {remaining} ชิ้น กรุณาลดจำนวนให้ไม่เกิน {remaining}{" "}
      ชิ้น
    </FieldError>
  )
}
