import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

// Format: "v1:" + base64url(iv[12] | tag[16] | ciphertext) — AES-256-GCM
// เวอร์ชันนำหน้าเผื่อหมุน key/algorithm ในอนาคต (ตอนนี้มีแค่ v1 = key เดียวจาก env)
const VERSION = "v1"
const IV_LENGTH = 12
const TAG_LENGTH = 16

export type EncryptionKey = Buffer

export function parseEncryptionKey(value: string | undefined): EncryptionKey {
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "EVOUCHER_ENCRYPTION_KEY must be 64 hex chars (32 bytes), e.g. `openssl rand -hex 32`"
    )
  }
  return Buffer.from(value, "hex")
}

const derive = (key: EncryptionKey, info: string) =>
  Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), info, 32))

/**
 * deterministic=true: IV = HMAC(plaintext) (synthetic IV) — ciphertext เดียวกันสำหรับ
 * plaintext เดียวกัน ทำให้ unique (pool_id, code) บังคับได้ที่ DB โดยไม่เก็บ plaintext
 * ใช้กับ code เท่านั้น; pin ใช้ random IV
 */
export function encryptSecret(
  plain: string,
  key: EncryptionKey,
  { deterministic = false }: { deterministic?: boolean } = {}
): string {
  const iv = deterministic
    ? createHmac("sha256", derive(key, "evoucher:iv:v1"))
        .update(plain, "utf8")
        .digest()
        .subarray(0, IV_LENGTH)
    : randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", derive(key, "evoucher:enc:v1"), iv)
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const out = Buffer.concat([iv, cipher.getAuthTag(), body])
  return `${VERSION}:${out.toString("base64url")}`
}

const CIPHERTEXT_PATTERN = new RegExp(
  `^${VERSION}:[A-Za-z0-9_-]{${Math.ceil(((IV_LENGTH + TAG_LENGTH) * 4) / 3)},}$`
)

/** กัน plaintext หลุดลง DB: ค่า code/pin ที่จะบันทึกต้องอยู่ในรูป `v1:<base64url>` เสมอ */
export function assertCiphertext(value: string): void {
  if (!CIPHERTEXT_PATTERN.test(value)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Refusing to store an evoucher secret that is not v1 ciphertext"
    )
  }
}

export function decryptSecret(value: string, key: EncryptionKey): string {
  const [version, payload] = value.split(":", 2)
  if (version !== VERSION || !payload) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unsupported evoucher ciphertext version: ${version}`
    )
  }
  const raw = Buffer.from(payload, "base64url")
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derive(key, "evoucher:enc:v1"),
    iv
  )
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(raw.subarray(IV_LENGTH + TAG_LENGTH)),
    decipher.final(),
  ]).toString("utf8")
}
