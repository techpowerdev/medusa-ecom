// AF-6 (review #138): admin แสดงเวลาตามเวลาไทยเสมอ (ไม่ขึ้นกับ timezone ของ browser) และเงินด้วย Intl
const TIME_ZONE = "Asia/Bangkok"

export const formatDate = (value: string | null, withTime = true) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        timeZone: TIME_ZONE,
        dateStyle: "medium",
        timeStyle: withTime ? "short" : undefined,
      })
    : "-"

// API ส่งหน่วยหลัก (major units) — แสดงตามนั้น ไม่หาร 100 และไม่ใช้คำนวณ
export const formatAmount = (amount: number | string, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    Number(amount),
  )
