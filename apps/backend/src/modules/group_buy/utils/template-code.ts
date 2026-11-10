import { randomInt } from "crypto"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const LENGTH = 12

export const TEMPLATE_CODE_PREFIX = "GBT-"

// สุ่มด้วย CSPRNG ให้เดาไม่ได้; ตัวพิมพ์ใหญ่ + ตัวเลขจึง URL-safe (ใช้ทั้ง code ต้นแบบและ join_token)
export function randomCode(length = LENGTH): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

// ADR-011 ข้อ 1: code ของ promotion ต้นแบบ — ไม่ขึ้นต้น "GB-" (ADR-009)
export function generateTemplateCode(): string {
  return TEMPLATE_CODE_PREFIX + randomCode()
}
