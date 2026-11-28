/**
 * padding (ซ้าย/ขวา) ของ header/แถวตาราง /cart และความกว้างกล่องจำนวนที่ ≥ 1024 (spec 01 กฎข้อ 100a) — ใช้ร่วมกันใน core-42 และ core-47
 * SFUI-24c (กฎข้อ 159a): ลบคอลัมน์ "รวม" — 4 ช่อง (สินค้า | ชื่อ | จำนวน | ราคาต่อชิ้น ที่ตำแหน่งเดิมของราคารวม) padding เดิมของแต่ละตำแหน่ง
 */
export const DESKTOP_BASELINE = {
  header: ["0px/16px", "16px/16px", "16px/16px", "16px/0px"],
  row: ["0px/16px", "16px/16px", "16px/16px", "16px/0px"],
  quantityBoxWidth: 112,
}
