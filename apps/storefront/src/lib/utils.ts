import { createCn } from "cn/config"

// SFUI-2 (session หลักตัดสิน Q1): utility ขนาดฟอนต์ที่ globals.css นิยามเอง (`@utility text-*`) — ต้องอยู่กลุ่ม font-size
// ไม่งั้น tailwind-merge เดาเป็นสีตัวอักษรแล้วตัดทิ้งเมื่อเจอ `text-<สี>` ในการเรียกเดียวกัน (utils.test.ts ตรวจว่าครบตาม globals.css)
export const FONT_SIZE_UTILITIES = [
  "xsmall-regular",
  "small-regular",
  "small-semi",
  "base-regular",
  "base-semi",
  "large-regular",
  "large-semi",
  "xl-regular",
  "xl-semi",
  "2xl-regular",
  "2xl-semi",
  "3xl-regular",
  "3xl-semi",
] as const

export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: [...FONT_SIZE_UTILITIES] }] } },
})
