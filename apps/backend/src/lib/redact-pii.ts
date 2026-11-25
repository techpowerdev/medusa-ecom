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

// (b) ค่าของ key (ไม่สนตัวพิมพ์) ใน JSON (`"key":"v"`), JS object/util.inspect (`key: 'v'` และ `` key: `v` `` — OPS-35) และ Ruby hash ที่ Stripe ใช้ใน error
// (`"key"=>"v"`) — ทั้งค่า string และตัวเลข (`postal_code: 10110`); alternation ไม่ซ้อนทับกัน จึงทำงานแบบ linear
// OPS-36: สตริงที่ util.inspect ตัดเป็นหลายท่อน (`'…\n' +\n    '…'` เมื่อสตริงยาวและมี `\n`; แต่ละท่อนใช้ quote คนละแบบได้) — redact ทุกท่อน
// รวมถึงเมื่อผล inspect ถูก JSON.stringify ซ้อน ≤ 3 ชั้น (review #554): newline ระหว่างท่อนเป็น backslash + `n` และท่อน `"` เป็น `\"…\"`
// (inspect ใช้ `"` เฉพาะเมื่อเนื้อหาไม่มี `"` ท่อนนั้นจึงจบที่ `"` ถัดไป) — ต่อท้ายได้ทั้งค่าที่ quote ปกติและค่าที่ escape
// OPS-35/36: JSON ที่ escape ซ้อน ≤ 3 ชั้น — quote ของชั้น k คือ backslash B = 2^k−1 ตัว (1, 3, 7) + `"` (≥ 4 ชั้น = 15 ตัวขึ้นไป ไม่ redact — ยอมรับ
// ตามกฎข้อ 18b รอบ 43; อีเมล/เบอร์ยังโดน (a)/(c)) ในค่าที่ escape ชั้น k ช่วง backslash n ตัวที่ตามด้วย `"` คือ quote ปิดก็ต่อเมื่อ n = m·(2B+2) + B
// (m = จำนวน backslash ในค่าเดิมก่อน quote ปิด — แต่ละตัวกลายเป็น 2B+2 = 2^(k+1) ตัว; จำนวนอื่นคือ quote/backslash ภายในค่า) — ค่าที่ลงท้ายด้วย backslash จึงปิดตรงตำแหน่งจริง ไม่กลืน key ถัดไป
// ภายในค่า token เป็น "ช่วง backslash ทั้งช่วง + อักขระ" หรืออักขระเดียว (แตกได้แบบเดียว → ไม่ backtrack ข้าม token)
const BS = "\\\\" // regex ของ backslash 1 ตัว
const escapedQuoteRun = (g: number) => `(?:\\${g}\\${g}${BS}${BS})*\\${g}"` // n = m·(2B+2) + B แล้ว " (B = group g)
// OPS-39 (กฎข้อ 21a รอบ 43): util.inspect quote ด้วย ' และ escape ' ภายในเป็น \' เมื่อสตริงมีครบทั้ง ', " และ backtick
// ใน JSON escape ชั้น k (h = 2^k): \' = backslash h ตัว + ' และ backslash จริง = 2h ตัว — `\\.` ของกิ่งทั่วไปปิดผิดที่เมื่อ k ≥ 1
// จึงลองทีละชั้น (3, 2, 1) โดยยืนยันชั้นด้วย " ภายในค่า (มีเสมอในกรณีนี้; JSON escape เป็น backslash h−1 ตัว + `"`)
// ก่อนเจอ " ที่ยืนยันชั้น ' ที่ปิดได้ทำให้กิ่งนั้นล้ม — กิ่งของชั้นที่ไม่ใช่จึงหยุดที่ ' หรือ " ถัดไป (quote เปิดของค่า/key ถัดไปเสมอ) ไม่กลืน key ถัดไป
const inspectEscapedQuoteBody = (h: number) => {
  const pairs = `(?:${BS}{${2 * h}})*`
  const plain = `(?:[^${BS}'"]|${BS}+[^${BS}'"]|${pairs}${BS}{${h}}')`
  const dq = `${pairs}${BS}{${h - 1}}"`
  return `${plain}*${dq}(?:${plain}|${dq})*${pairs}'`
}
const INSPECT_ESCAPED_QUOTE = `(?:${[8, 4, 2].map(inspectEscapedQuoteBody).join("|")})` // ใช้หลัง ' เปิดเท่านั้น
const INSPECT_SEGMENT = `(?:'${INSPECT_ESCAPED_QUOTE}|'(?:\\\\.|[^'\\\\])*'|\\\\+"[^"]*"|"(?:\\\\.|[^"\\\\])*"|\`(?:\\\\.|[^\`\\\\])*\`)`
const INSPECT_TAIL = `(?:(?:\\s|\\\\+n)*\\+(?:\\s|\\\\+n)*${INSPECT_SEGMENT})*`
// ค่าเดี่ยว: group g = quote, g+1 = backslash ของ quote ที่ escape (ESCAPED_OPEN — ลองช่วงยาวก่อน)
const scalarValue = (g: number) =>
  `(["'\`])(?:(?<=')${INSPECT_ESCAPED_QUOTE}|(?:\\\\.|(?!\\${g})[^\\\\])*\\${g})${INSPECT_TAIL}` +
  `|(\\\\{7}|\\\\{3}|\\\\)"(?:(?!${escapedQuoteRun(g + 1)})(?:\\\\+[^\\\\]|[^\\\\]))*${escapedQuoteRun(g + 1)}${INSPECT_TAIL}` +
  `|\\d+(?:\\.\\d+)?(?![\\w.])`
// OPS-39 (กฎข้อ 21b รอบ 43): array แบบแบน (JSON, JSON escape, util.inspect บรรทัดเดียว/หลายบรรทัด/`... n more items`) — redact ทั้ง array
// สมาชิกจับแบบ atomic (`(?=(x))\4`) จึงแตกได้แบบเดียว ตัวคั่นกับสมาชิกขึ้นต้นด้วยอักขระคนละชุด → linear; array ซ้อน/object ไม่ match (ไม่บังคับ) และไม่กลืนค่าหลัง ]
const ARRAY_SEPARATOR = "(?:\\s|,|\\\\+n|\\.\\.\\. \\d+ more items?)"
const KEY_VALUE = new RegExp(
  `((?<![A-Za-z0-9_$])(\\\\{0,7}["']|)(?:${PII_KEYS.join("|")})\\2\\s*(?::|=>)\\s*)` +
    `(?:(\\[)(?:${ARRAY_SEPARATOR}|(?=(${scalarValue(5)}))\\4)*\\]|${scalarValue(7)})`,
  "gi"
)
// (a) สตริงรูปอีเมล — เริ่ม match ได้เฉพาะต้นช่วงอักขระ local และจำกัดความยาวตาม RFC 5321 (local ≤ 64, label ≤ 63)
// กัน backtrack แบบ O(n²) กับช่วงยาวที่ไม่มี `@` (review #473: errorHandler ของ Medusa log `req.path` จาก client ที่ไม่ login)
// OPS-35: local part มี `'` ได้ (`o'brien@…`) แต่ต้องขึ้นต้นด้วยอักขระอื่น (ไม่กลืน quote เปิดของ util.inspect) — `'` ไม่อยู่ใน lookbehind
// จึงเริ่ม match ได้หลัง `'` ด้วย แต่ยังจำกัด local ≤ 64 ต่อจุดเริ่ม (linear)
// TLD ต้องเป็นตัวอักษร ≥ 2 และไม่ใช่นามสกุลไฟล์รูป/asset (`image@2x.png`)
const EMAIL =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-][A-Za-z0-9._%+'-]{0,63}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,63}(?<!\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp|css|js|map))(?![A-Za-z0-9-])/g
// (c) เบอร์ไทย `0` + 8–9 หลัก หรือ `+66` + 8–9 หลัก ที่ขอบทั้งสองข้างไม่ใช่ตัวอักษร/ตัวเลข (ไม่ตัดเลขกลาง ULID ของ id)
// และไม่อยู่หลัง `.` (ไม่ตัดทศนิยมของจำนวนเงิน เช่น raw_amount `1.0666666667`)
const THAI_PHONE = /(?<![A-Za-z0-9.])(?:0|\+66)\d{8,9}(?![A-Za-z0-9])/g

export function redactPii(text: string): string {
  return text
    .replace(KEY_VALUE, (_match, ...groups: (string | undefined)[]) => {
      const [prefix, , bracket, , itemQuote, itemEscaped, quote, escaped] = groups
      // array ใช้ quote ของสมาชิกตัวสุดท้าย (JSON ระดับ 0 ยัง parse ได้)
      const [open, escapedOpen] = bracket ? [itemQuote, itemEscaped] : [quote, escaped]
      const q = open ?? (escapedOpen === undefined ? "" : `${escapedOpen}"`)
      const value = `${q}${REDACTED}${q}`
      return bracket ? `${prefix}[${value}]` : `${prefix}${value}`
    })
    .replace(EMAIL, REDACTED)
    .replace(THAI_PHONE, REDACTED)
}

const PII_KEY_SET = new Set(PII_KEYS)
const isPiiKey = (key?: string) => key !== undefined && PII_KEY_SET.has(key.toLowerCase())

/** redact ทุกสตริงใน field ของ log (รวม object/array/Error/Map ซ้อน) — คืนสำเนา ไม่แก้ object ของผู้เรียก */
export function redactValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return isPiiKey(key) ? REDACTED : redactPii(value)
  }
  if ((typeof value === "number" || typeof value === "bigint") && isPiiKey(key)) {
    return REDACTED
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value
  }
  const proto = Object.getPrototypeOf(value)
  const isError = value instanceof Error
  const isMap = value instanceof Map
  if (!Array.isArray(value) && !isError && !isMap && proto !== Object.prototype && proto !== null) {
    return value
  }
  // seen = บรรพบุรุษในเส้นทางปัจจุบันเท่านั้น (กัน cycle) — object เดียวกันที่ซ้ำคนละกิ่งยังถูก redact
  seen.add(value)
  const entries = (pairs: [string, unknown][]) =>
    Object.fromEntries(pairs.map(([k, v]) => [k, redactValue(v, k, seen)]))
  let copy: unknown
  if (Array.isArray(value)) {
    // OPS-39 (กฎข้อ 21c รอบ 43): สมาชิกของ array ใต้ key PII ถือเป็นค่าของ key นั้น
    copy = value.map((item) => redactValue(item, key, seen))
  } else if (isMap) {
    // Map/Error ถูก JSON.stringify เป็น `{}`/ไม่มี message — แปลงเป็น plain object ที่ redact แล้ว
    copy = entries([...value].map(([k, v]) => [String(k), v]))
  } else if (isError) {
    copy = {
      ...entries(Object.entries(value)),
      name: value.name,
      message: redactPii(value.message),
      ...(value.stack ? { stack: redactPii(value.stack) } : {}),
    }
  } else {
    copy = entries(Object.entries(value))
  }
  seen.delete(value)
  return copy
}
