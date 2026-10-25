import { isEmpty } from "./isEmpty"

type ConvertToLocaleParams = {
  amount: number
  currency_code: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  locale?: string
}

// THB (ADR-008 ข้อ 5): ฿1,000 เมื่อเป็นจำนวนเต็ม (หลังปัด 2 ตำแหน่ง) และ ฿1,000.50 เมื่อมีสตางค์
// เหมือนกันทุก locale; ผู้เรียกที่ส่งจำนวนทศนิยมมาเองใช้ค่าของผู้เรียก
const thbFractionDigits = (
  amount: number,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number
) => {
  if (
    minimumFractionDigits !== undefined ||
    maximumFractionDigits !== undefined
  ) {
    return { minimumFractionDigits, maximumFractionDigits }
  }

  const digits = Math.round(amount * 100) % 100 === 0 ? 0 : 2

  return { minimumFractionDigits: digits, maximumFractionDigits: digits }
}

export const convertToLocale = ({
  amount,
  currency_code,
  minimumFractionDigits,
  maximumFractionDigits,
  locale = "th-TH",
}: ConvertToLocaleParams) => {
  if (!currency_code || isEmpty(currency_code)) {
    return amount.toString()
  }

  if (currency_code.toLowerCase() === "thb") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency_code,
      currencyDisplay: "narrowSymbol",
      ...thbFractionDigits(
        amount,
        minimumFractionDigits,
        maximumFractionDigits
      ),
    }).format(amount)
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency_code,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount)
}
