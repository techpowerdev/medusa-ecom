import { randomBytes } from "node:crypto"
import {
  decryptSecret,
  encryptSecret,
  parseEncryptionKey,
} from "../utils/crypto"

const KEY_HEX = randomBytes(32).toString("hex")

describe("evoucher crypto", () => {
  describe("parseEncryptionKey", () => {
    it("accepts a 64-char hex key (32 bytes)", () => {
      expect(parseEncryptionKey(KEY_HEX)).toHaveLength(32)
    })

    it.each([undefined, "", "abc", "z".repeat(64), KEY_HEX.slice(0, 62)])(
      "rejects missing or malformed key %p",
      (value) => {
        expect(() => parseEncryptionKey(value)).toThrow(
          /EVOUCHER_ENCRYPTION_KEY/
        )
      }
    )
  })

  describe("round-trip", () => {
    const key = parseEncryptionKey(KEY_HEX)

    it.each([
      ["random iv", false],
      ["deterministic iv", true],
    ])("decrypts what it encrypts (%s)", (_label, deterministic) => {
      const plain = "LOTUS-500-ABCD-1234 ไทย"
      const cipher = encryptSecret(plain, key, { deterministic })
      expect(cipher).not.toContain(plain)
      expect(cipher.startsWith("v1:")).toBe(true)
      expect(decryptSecret(cipher, key)).toBe(plain)
    })

    it("random iv produces a different ciphertext each time", () => {
      expect(encryptSecret("1234", key)).not.toBe(encryptSecret("1234", key))
    })

    it("deterministic iv produces the same ciphertext for the same plaintext (unique per pool)", () => {
      const a = encryptSecret("CODE-1", key, { deterministic: true })
      expect(encryptSecret("CODE-1", key, { deterministic: true })).toBe(a)
      expect(encryptSecret("CODE-2", key, { deterministic: true })).not.toBe(a)
    })

    it("fails on a tampered ciphertext", () => {
      const cipher = encryptSecret("CODE-1", key)
      const raw = Buffer.from(cipher.slice(3), "base64url")
      raw[raw.length - 1] ^= 0xff
      expect(() =>
        decryptSecret(`v1:${raw.toString("base64url")}`, key)
      ).toThrow()
    })

    it("fails with a different key", () => {
      const cipher = encryptSecret("CODE-1", key)
      const otherKey = parseEncryptionKey(randomBytes(32).toString("hex"))
      expect(() => decryptSecret(cipher, otherKey)).toThrow()
    })

    it("rejects an unknown format version", () => {
      expect(() => decryptSecret("v9:AAAA", key)).toThrow(/version/)
    })
  })
})
