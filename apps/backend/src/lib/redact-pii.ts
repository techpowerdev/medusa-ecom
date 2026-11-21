// OPS-33 (spec 07 กฎข้อ 15 รอบ 41): แทน PII ของลูกค้าในข้อความ log ของ prod ด้วย `[REDACTED]`
// ที่มา: Medusa 2.22.1 log `recreate a payment session … Invalid string: {…}` พร้อม billing_details ของลูกค้า (OPS-32)
// ไม่แตะ id (`cart_…`, `pay_…`, `pi_…`), request_id และจำนวนเงิน
export const REDACTED = "[REDACTED]"

export const PII_KEYS = [
  "email",
  "phone",
  "name",
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "line1",
  "line2",
  "city",
  "province",
  "state",
  "postal_code",
]

// (b) ค่าสตริงของ key ใน JSON (`"key":"v"`), JS object/util.inspect (`key: 'v'`) และ Ruby hash ที่ Stripe ใช้ใน error (`"key"=>"v"`)
const KEY_VALUE = new RegExp(
  `((?<![A-Za-z0-9_$])(["']?)(?:${PII_KEYS.join("|")})\\2\\s*(?::|=>)\\s*)(["'])(?:\\\\.|(?!\\3)[^\\\\])*\\3`,
  "g"
)
// (a) ทุกสตริงรูปอีเมล
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// (c) เบอร์ไทย `0` + 8–9 หลัก หรือ `+66` + 8–9 หลัก ที่ขอบทั้งสองข้างไม่ใช่ตัวอักษร/ตัวเลข (ไม่ตัดเลขกลาง ULID ของ id)
const THAI_PHONE = /(?<![A-Za-z0-9])(?:0|\+66)\d{8,9}(?![A-Za-z0-9])/g

export function redactPii(text: string): string {
  return text
    .replace(KEY_VALUE, `$1$3${REDACTED}$3`)
    .replace(EMAIL, REDACTED)
    .replace(THAI_PHONE, REDACTED)
}

const PII_KEY_SET = new Set(PII_KEYS)

/** redact ทุกสตริงใน field ของ log (รวม object/array ซ้อน) — คืนสำเนา ไม่แก้ object ของผู้เรียก */
export function redactValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return key !== undefined && PII_KEY_SET.has(key) ? REDACTED : redactPii(value)
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value
  }
  const proto = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    return value
  }
  // seen = บรรพบุรุษในเส้นทางปัจจุบันเท่านั้น (กัน cycle) — object เดียวกันที่ซ้ำคนละกิ่งยังถูก redact
  seen.add(value)
  const copy = Array.isArray(value)
    ? value.map((item) => redactValue(item, undefined, seen))
    : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v, k, seen)]))
  seen.delete(value)
  return copy
}
