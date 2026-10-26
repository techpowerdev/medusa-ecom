// spec 01 กฎข้อ 42: ทุกจุดที่แสดงวันที่ใช้เขตเวลาไทย — server (UTC) กับ browser จึงได้ข้อความเดียวกัน
// (ไม่มี hydration mismatch) และวันไม่เพี้ยนช่วง 00:00–07:00 เวลาไทย
const dateFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
})

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "medium",
  timeStyle: "short",
})

/** เช่น "26 ต.ค. 2569" */
export const formatDate = (value: string | Date) => dateFormat.format(new Date(value))

/** เช่น "26 ต.ค. 2569 01:30" */
export const formatDateTime = (value: string | Date) => dateTimeFormat.format(new Date(value))
