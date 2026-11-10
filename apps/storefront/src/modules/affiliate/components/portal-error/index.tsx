// AF-8c (spec 05 กฎ 36b): backend ไม่ตอบ/5xx ตอนโหลดหน้า portal → ข้อความไทยพร้อมลิงก์ลองใหม่ แทนหน้า error ของ Next
// ลิงก์เป็น <a> ธรรมดาไปที่ URL ปัจจุบัน (href="") เพื่อโหลดหน้าใหม่ทั้งหน้าให้ server component ดึงข้อมูลอีกครั้ง
export default function PortalError() {
  return (
    <div className="content-container py-12" data-testid="affiliate-portal-error">
      <p className="rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-4">
        ระบบแอฟฟิลิเอตไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่{" "}
        <a href="" className="underline" data-testid="affiliate-portal-retry">
          ลองใหม่
        </a>
      </p>
    </div>
  )
}
