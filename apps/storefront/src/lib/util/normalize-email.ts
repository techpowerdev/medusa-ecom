// CORE-73 F-1 (qa #458, session หลักตัดสิน 2026-11-21): emailpass ของ Medusa เทียบอีเมลแบบแยกตัวพิมพ์
// → `A@x.com` กับ `a@x.com` เป็น identity คนละตัว ทำให้สมัครบัญชีซ้ำได้ storefront จึง normalize ก่อนส่งทุกทางเข้า
// (สมัคร/login ของลูกค้า และ portal affiliate ที่ใช้ identity emailpass ชุดเดียวกัน)
export const normalizeEmail = (email: unknown): string => String(email ?? "").trim().toLowerCase()
