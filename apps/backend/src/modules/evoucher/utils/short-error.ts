// ข้อความ error ในอีเมล admin/log ของ e-voucher: เฉพาะ message (ไม่ใส่ data ของ notification) ยุบบรรทัดและตัดไม่เกิน 200 ตัวอักษร
// error จาก `workflow.run()` ไม่ใช่ instanceof Error (เป็น object ที่มี message) จึงอ่าน `.message` ตรงๆ
export const shortError = (error: unknown) =>
  String((error as Error)?.message ?? error)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
