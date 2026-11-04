// สถานะของ code e-voucher — แหล่งเดียว (ไม่ import sdk เพื่อให้ lib ที่เป็น pure function ใช้ร่วมและ unit test ได้)
export const CODE_STATUSES = ["available", "allocated", "delivered", "void"] as const
export type CodeStatus = (typeof CODE_STATUSES)[number]
