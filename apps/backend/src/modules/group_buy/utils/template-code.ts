import { randomInt } from "crypto"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const LENGTH = 12

export const TEMPLATE_CODE_PREFIX = "GBT-"

// ADR-011 ข้อ 1: code ของ promotion ต้นแบบ — สุ่มด้วย CSPRNG ให้เดาไม่ได้ และไม่ขึ้นต้น "GB-" (ADR-009)
export function generateTemplateCode(): string {
  let suffix = ""
  for (let i = 0; i < LENGTH; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)]
  }
  return TEMPLATE_CODE_PREFIX + suffix
}
