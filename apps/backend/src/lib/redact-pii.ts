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
const KEY_NAMES = `(?:${PII_KEYS.join("|")})`
// OPS-39 (review #559): รูป `<pii-key>:` (รวม quote ของ key ที่ escape ≤ 3 ชั้น และ `=>`)
const KEY_AHEAD = `(?<![A-Za-z0-9_$])${KEY_NAMES}${BS}{0,7}["']?\\s*(?::|=>)`
// guard ก่อนอักขระเนื้อหาของกิ่งใหม่ (สมาชิก array และ \' ชั้น 1–3) — lookahead ความยาวคงที่ ตรวจเฉพาะบางอักขระ จึงยัง linear:
// เนื้อหาห้ามข้ามขอบของโครงสร้าง (quote เปิดของสมาชิกอาจเป็น quote ปิดของค่าอื่น เช่น `{ message: 'city: [', total: '1999.50' }`)
// - key PII (`<pii-key>:`) → ไม่กลืน key ถัดไป และการสแกนจากจุดเริ่มใดๆ หยุดก่อน key PII ถัดไป
// - newline ดิบ (เนื้อหา string ของ inspect/JSON escape เป็น \n เสมอ)
// - newline ที่ escape + เยื้อง ≥ 2 ช่อง + `key: <ค่า>` (บรรทัดใหม่ของ inspect/pretty-print ที่ถูก JSON.stringify) — ตรวจที่ `n` หลัง backslash
const FIELD_LINE = `(?<=${BS})n[ \\t]{2,}${BS}{0,7}["']?[A-Za-z_$][\\w$]*${BS}{0,7}["']?\\s?:[ \\t]?(?:${BS}{0,7}["'\`\\[{]|\\d|null|true|false)`
const G = `(?![\\r\\n]|${KEY_AHEAD}|${FIELD_LINE})`
// - เฉพาะเนื้อหาที่ quote ด้วย ' หรือ backtick (inspect): ขอบ field ของ JSON `,"key":<ค่า>` (quote ของ key escape 0–3 ชั้น) — ตรวจที่ `,`
//   (ในเนื้อหาที่ quote ด้วย " quote ที่ escape เป็นเนื้อหาปกติ จึงไม่ใช้)
const FIELD_JSON = `,[ \\t]?${BS}{0,7}"[A-Za-z_$][\\w$]*${BS}{0,7}":[ \\t]?(?:${BS}{0,7}["\\[{]|-?\\d|null|true|false)`
const GQ = `(?![\\r\\n]|${KEY_AHEAD}|${FIELD_LINE}|${FIELD_JSON})`
// หลังค่าของกิ่งใหม่: ห้ามตามด้วย `:`/`=>` (ค่านั้นคือ key ไม่ใช่สมาชิก) หรือชื่อ key PII (quote ปิดของค่าคือ quote เปิดของ key ถัดไป)
const NOT_KEY_AFTER = `(?!\\s*(?::|=>)|${KEY_AHEAD})`
const escapedQuoteRun = (g: number) => `(?:\\${g}\\${g}${BS}${BS})*\\${g}"` // n = m·(2B+2) + B แล้ว " (B = group g)
// OPS-39 (กฎข้อ 21a รอบ 43): util.inspect quote ด้วย ' และ escape ' ภายในเป็น \' เมื่อสตริงมีครบทั้ง ', " และ backtick
// ใน JSON escape ชั้น k (h = 2^k): \' = backslash h ตัว + ' และ backslash จริง = 2h ตัว — `\\.` ของกิ่งทั่วไปปิดผิดที่เมื่อ k ≥ 1
// จึงลองทีละชั้น (3, 2, 1) โดยยืนยันชั้นด้วย " ภายในค่า (มีเสมอในกรณีนี้; JSON escape เป็น backslash h−1 ตัว + `"`)
// ก่อนเจอ " ที่ยืนยันชั้น ' ที่ปิดได้ทำให้กิ่งนั้นล้ม — กิ่งของชั้นที่ไม่ใช่จึงหยุดที่ ' หรือ " ถัดไป; ค่าที่ข้ามขอบโครงสร้าง (GQ)
// ไม่เข้ากิ่งนี้แต่ตกไปกิ่งทั่วไปแบบเดิม — กิ่งนี้จึงไม่กลืนสิ่งที่ develop ไม่กลืน
const inspectEscapedQuoteBody = (guard: string) => (h: number) => {
  const pairs = `(?:${BS}{${2 * h}})*`
  const plain = `(?:${BS}*${guard}[^${BS}'"]|${pairs}${BS}{${h}}')`
  const dq = `${pairs}${BS}{${h - 1}}"`
  return `${plain}*${dq}(?:${plain}|${dq})*${pairs}'${NOT_KEY_AFTER}`
}
const INSPECT_ESCAPED_QUOTE = `(?:${[8, 4, 2].map(inspectEscapedQuoteBody(GQ)).join("|")})` // ใช้หลัง ' เปิดเท่านั้น
// OPS-40 (กฎข้อ 22b รอบ 43): ค่าเดี่ยวไม่ใช้ guard รูป `<pii-key>:` — เนื้อหาของค่า PII มีข้อความ `city: y` ได้ (เดิมกิ่งนี้ล้มแล้วตกไป `\\.` ที่ปิดผิดที่)
// ค่าของ key ที่ไม่ใช่ PII ถูกจับเป็น field ทั้งก้อนแล้ว (NON_PII_FIELD) จึงไม่มี `<pii-key>:` ปลอมในค่าอื่นให้กิ่งนี้เริ่มจาก
const INSPECT_ESCAPED_QUOTE_SCALAR = `(?:${[8, 4, 2].map(inspectEscapedQuoteBody(`(?![\\r\\n]|${FIELD_LINE}|${FIELD_JSON})`)).join("|")})`
// ค่าของ field ที่ไม่ใช่ PII (NON_PII_FIELD) guard แค่ newline ดิบ: เนื้อหาหน้าตาเหมือนขอบ field (`\n  email: …`, `,\"name\":\"`) ต้องไม่ทำให้ปิดผิดที่
// (จับเกินไม่ทำให้หลุดเพราะภายในค่ายังถูก redact ด้วย PII_ONLY)
const INSPECT_ESCAPED_QUOTE_FIELD = `(?:${[8, 4, 2].map(inspectEscapedQuoteBody("(?![\\r\\n])")).join("|")})`
// g / gq = guard ก่อนอักขระเนื้อหาที่ quote ด้วย " / ' หรือ backtick ("" = แบบเดิมของ develop สำหรับค่าเดี่ยว)
const inspectSegment = (g: string, gq: string) =>
  `(?:'${INSPECT_ESCAPED_QUOTE}|'(?:${BS}${gq}.|${gq}[^'${BS}])*'|${BS}+"(?:${g}[^"])*"|"(?:${BS}${g}.|${g}[^"${BS}])*"|\`(?:${BS}${gq}.|${gq}[^\`${BS}])*\`)`
const inspectTail = (g: string, gq: string) => `(?:(?:\\s|${BS}+n)*\\+(?:\\s|${BS}+n)*${inspectSegment(g, gq)})*`
// ค่าเดี่ยว (แบบเดิมของ develop + กิ่ง \'): group n = quote, n+1 = backslash ของ quote ที่ escape (ESCAPED_OPEN — ลองช่วงยาวก่อน)
// nl = อักขระเพิ่มที่เนื้อหาห้ามมี ("" = แบบเดิมของ develop สำหรับค่า PII; สมาชิกของ field ที่ไม่ใช่ PII ห้ามมี newline ดิบ — สตริงของ inspect/JSON
// ไม่มี newline ดิบ; re-review #562 รอบ 6: สมาชิกปลอม `'{"\n  },\n  last_name: '` ข้ามบรรทัดแล้วกลืน quote เปิดของ key PII)
const quotedString = (n: number, escapedQuote = INSPECT_ESCAPED_QUOTE_SCALAR, nl = "") =>
  `(["'\`])(?:(?<=')${escapedQuote}|(?:${BS}${nl ? `[^${nl}]` : "."}|(?!\\${n})[^${BS}${nl}])*\\${n})` +
  `|(${BS}{7}|${BS}{3}|${BS})"(?:(?!${escapedQuoteRun(n + 1)})(?:${BS}+[^${BS}${nl}]|[^${BS}${nl}]))*${escapedQuoteRun(n + 1)}`
const scalarValue = (n: number) => `(?:${quotedString(n)})${inspectTail("", "")}|\\d+(?:\\.\\d+)?(?![\\w.])`
// สมาชิก array: เนื้อหามี guard; สมาชิกที่ escape ชั้น k (quote = backslash B ตัว) ห้ามมี " ที่ backslash น้อยกว่า B (= โครงสร้างของชั้นที่ต่ำกว่า)
// group n = quote ' หรือ backtick, n+1 = backslash ของ quote ที่ escape
const itemValue = (n: number) =>
  `(?:"(?:${BS}${G}.|${G}[^"${BS}])*"` +
  `|(['\`])(?:(?<=')${INSPECT_ESCAPED_QUOTE}|(?:${BS}${GQ}.|${GQ}(?!\\${n})[^${BS}])*\\${n})` +
  `|(${BS}{7}|${BS}{3}|${BS})"(?:(?!${escapedQuoteRun(n + 1)})(?:\\${n + 1}${BS}*"|${BS}*${G}[^${BS}"]))*${escapedQuoteRun(n + 1)})${inspectTail(G, GQ)}` +
  `|-?\\d+(?:\\.\\d+)?(?![\\w.])|(?:null|true|false|undefined)(?![\\w$])`
// OPS-39 (กฎข้อ 21b รอบ 43): array แบบแบน (JSON, JSON escape, util.inspect บรรทัดเดียว/หลายบรรทัด/`... n more items`) — redact ทั้ง array
// สมาชิกจับแบบ atomic (`(?=(x))\5`) จึงแตกได้แบบเดียว ตัวคั่นกับสมาชิกขึ้นต้นด้วยอักขระคนละชุด และต้องปิดด้วย `]`
// (array ซ้อน/object ใน array ไม่ redact — ไม่บังคับตามกฎ 21b); guard ทำให้การสแกนจากแต่ละจุดเริ่มไม่เกิน key PII ถัดไป → linear
// re-review #559 รอบ 3 (ไม่กลืนจำนวนเงิน/id/key ที่ไม่ใช่ PII):
// - สมาชิกต้องตามด้วยขอบของ array (`,`, `]`, newline/`\n` ที่ escape หรือท้ายข้อความ) — สมาชิกปลอม `', total: '` ตามด้วย `1999.50'` จึงไม่นับ
// - กิ่ง array ใช้เฉพาะ key ที่ตำแหน่งของโครงสร้าง (ต้นข้อความ หรือหลัง `{` `,` `[` newline ดิบ/ที่ escape + ช่องว่าง)
//   ข้อความ `name: [` ในค่าอื่น (`'Invalid name: ['`) จึงไม่เริ่ม array
const ARRAY_SEPARATOR = `(?:\\s|,|${BS}+n|\\.\\.\\. \\d+ more items?)`
const ITEM_END = `(?=\\s*(?:[,\\]]|${BS}+n|$))`
// re-review #559 รอบ 4: ใช้หลัง `(?=\[)` เท่านั้น — ถ้าไม่ตรวจ `[` ก่อน `\s*` ท้าย prefix ที่ backtrack ทุกตำแหน่งจะย้อน lookbehind ผ่านช่วง whitespace ทั้งช่วง (O(n²))
const STRUCTURAL_KEY = `(?<=(?:^|[{,\\[\\n]|${BS}+n)[ \\t]*${BS}{0,7}["']?${KEY_NAMES}${BS}{0,7}["']?\\s*(?::|=>)\\s*)`
const PII_KEY_VALUE =
  `((?<![A-Za-z0-9_$])(${BS}{0,7}["']|)${KEY_NAMES}\\2\\s*(?::|=>)\\s*)` +
  `(?:(?=\\[)${STRUCTURAL_KEY}(\\[)((?:${ARRAY_SEPARATOR}|(?=(${itemValue(6)})${NOT_KEY_AFTER}${ITEM_END})\\5)*)(\\])|${scalarValue(9)})`
// OPS-40 (กฎข้อ 22a รอบ 43, review #559): ค่าของ key ที่ไม่ใช่ PII ที่ลงท้ายด้วยรูปเปิด key PII (`{ note: "name: '", city: 'Bangkok' }`)
// เดิม `name: '` ในเนื้อหาเริ่ม match แล้ว quote ปิดของ note กลายเป็น quote เปิดของค่าปลอม → ปิดที่ quote เปิดของ city → "Bangkok" หลุด
// จึงจับ field ที่ไม่ใช่ PII ที่ตำแหน่งโครงสร้าง (ต้นข้อความ หรือหลัง `{` `,` newline ดิบ/ที่ escape + ช่องว่าง) ทั้งค่า (สตริง/ท่อน `+`/array แบนหรือซ้อน — `[` `]` เป็นตัวคั่น, re-review #562 รอบ 4)
// แล้ว redact ภายในค่าด้วย PII_ONLY (ข้อความอิสระ `Invalid name: 'x'` ในค่ายังถูก redact เหมือนเดิม) — match ของ key PII ปลอมในค่าจึงไม่ข้ามขอบค่า
// - key = identifier หรือข้อความใน quote (escape 0–3 ชั้น — `'x-note'`, `"user-agent"`, `'ชื่อ'`; review #562: key ที่ไม่ใช่ identifier เคยไม่ถูกจับ
//   แล้ว `, b: ` ในค่าเริ่ม field ปลอมที่กลืน quote เปิดของ key PII ถัดไป) ที่ไม่ใช่ key PII — ยกเว้น key PII ที่ค่าเป็น `[` แต่ไม่ผ่านกิ่ง array
//   (กฎ 22f: สมาชิกหน้าตาเหมือนขอบ field) ซึ่งถูกจับเป็น field เพื่อไม่ให้ขอบ field ปลอมในสมาชิกกลืน key PII ค่าเดี่ยวถัดไป (เดิมสแกนเข้าไปใน array)
// - lookahead ก่อน lookbehind ทุกตัว (บทเรียน `(?=\[)` ของ #559); ค่าที่ขึ้นต้นด้วย quote/backslash/`[` ถูกจับด้วย ค่าอื่น (object/ตัวเลข) จับเฉพาะ key
//   (re-review #562 รอบ 3: ข้อความใน key เช่น `"it's: name: '1": {…}` ห้ามเริ่ม match ที่ข้ามขอบ key) — ข้อความใน key ยัง redact ด้วย PII_ONLY แบบเดิม
// - สมาชิก/ท่อนจับแบบ atomic (`(?=(x))\16`) ตัวคั่นเป็นช่วงอักขระชุดเดียว (`[\s,+]+`) และต้องตามด้วยขอบของค่า (`,` `]` `}` ` +` ที่มีช่องว่างนำและท่อนถัดไปขึ้นต้นด้วย quote (re-review #562 รอบ 7: `],\n  '\\' + …` คือ key หลายท่อนบรรทัดถัดไป ไม่ใช่ท่อนของสมาชิก) — `+` ติดกันคือค่าถัดไปที่ขึ้นต้นด้วย `+`, newline ดิบ/ที่ escape
//   หรือท้ายข้อความ — แบบ ITEM_END) — สมาชิกปลอมที่ quote เปิดคือ quote ปิดของค่าอื่น (`', name: '` ตามด้วย `สมชาย`), ที่เป็น key ถัดไป (`"x","name":`)
//   หรือที่ปิดผิดที่ (`'\\'` ของ \' ชั้น 1) จึงไม่นับ
// - จับได้เกินจริง (สตริงถัดไปที่ไม่ใช่ key) ไม่ทำให้หลุด เพราะภายในยังถูก redact; จับได้ไม่ครบ (`]` ไม่บังคับ) = พฤติกรรมเดิมกับส่วนที่เหลือ
// ความยาว source ต้องไม่เกิน ~20KB (V8 ปิด optimization ของ regex ที่ใหญ่กว่านั้น — วัดได้ช้าลง ~10 เท่าและ backtrack stack ล้นเร็วขึ้น)
// key ใน quote (re-review #562 — key ที่มี quote อีกชนิด/backslash/\n ข้างใน ต้องปิดถูกที่ ไม่งั้นค่าของมันไม่ถูกจับเป็น field):
// - quote `"` (JSON escape ทุกชั้นสม่ำเสมอ): group 12 = backslash ของ quote (ชั้น k = 2^k−1 ตัว), 13 = `"` — quote ปิด = ช่วง backslash m·(2B+2)+B ตัว + `"` (แบบ escapedQuoteRun)
// - quote ' หรือ backtick ของ inspect (group 15/16/17 — JSON ไม่ escape ' จึงไม่รู้ชั้น): ปิดที่ quote แรกที่ไม่มี backslash นำและตามด้วย `:`/`=>`
//   (re-review #562 รอบ 5: ช่วง backslash หน้า quote ที่ 2^k(2m+1) ตัวคือ \' ส่วน 2^(k+1)·m ตัวคือ backslash จริงท้าย key — ต้องรู้ชั้น k
//   key ที่ขึ้นบรรทัดใหม่ อ่านชั้นจาก newline นำหน้า: newline ดิบ = ชั้น 0 (quote ปิดมี backslash 2m ตัว — group 16); ชั้น k ≥ 1 newline เป็น
//   backslash N = 2^(k−1) ตัว + n (group 14) และ quote ปิดมี backslash 2^(k+1)·m = 4N·m ตัว (group 15)
//   key ใน ' ต้องอยู่หลัง `{`/`,` + newline + เยื้อง หรือหลัง `{ ` / `, ` ที่ตามจุดจบของค่าก่อนหน้า (quote ที่มี backslash นำเป็นจำนวนคู่ — ค่าที่ลงท้ายด้วย
//   backslash จริงของชั้น 0 — หรือ `"`, `]` `)` `}` ตัวอักษร/ตัวเลข; inspect เขียนแบบนี้เสมอ — re-review #562 รอบ 5)
//   key ในบรรทัดเดียวกัน (หลัง `{ ` `, `) ไม่รู้ชั้น → quote ปิดต้องไม่มี backslash นำ (key ที่ลงท้ายด้วย backslash ไม่ถูกจับ = ทำงานแบบ develop)
//   ช่องที่เหลือของ key กลุ่มนี้ = ข้อยกเว้น (d2) ของกฎข้อ 22d รอบ 43 (owner 2026-11-25) — ปิดจริงใน OPS-41 (parser ที่นับชั้น escape)
//   เดิมยอม backslash ใดก็ได้จึงปิดผิดที่ตรง `\':` กลาง key ที่มี ' " backtick ครบ แล้วค่าของ field กลืน key PII ถัดไป)
//   เนื้อหาข้าม quote ที่ไม่มี backslash นำไม่ได้ — การสแกนจากแต่ละ quote เปิดหยุดที่ quote ถัดไป (ReDoS: `, 'x\\` ซ้ำ)
// - quote `"`: เนื้อหาข้าม `"` ที่ไม่มี backslash นำไม่ได้ (ชั้นนอกกว่า) และหยุดที่ quote ปิดของชั้นตัวเอง
// ไม่จำกัดความยาว key และรับ key ว่าง `''` (re-review #562 รอบ 3–4) — token = ช่วง backslash + อักขระ หรืออักขระเดียว (แตกได้แบบเดียว) และการสแกนจากแต่ละ quote เปิด
// หยุดที่ quote ถัดไปที่ไม่มี backslash นำ (quote ชนิดเดียวกัน) จึงไม่ซ้อนทับกัน → linear
// - สมาชิกของ array ที่ไม่มี key (re-review #562 รอบ 4 — fuzz object ซ้อน/Map ของ builder): สตริงหลัง Map/object ใน array ที่ค่าของ field จับไม่ถึง
//   จับเป็น field ไม่มี key ได้ที่ตำแหน่งสมาชิก — `"` หลัง `[` `,` newline; ' หรือ backtick หลัง `[ ` หรือ `, ` ที่ตามหลังจุดจบของสมาชิกก่อนหน้า
//   (เงื่อนไขจุดจบเดียวกับ key ด้านบน — re-review #562 รอบ 5: `\', '` ใน key เคยเริ่มสมาชิกปลอม) หรือ `,`/`[` + newline + เยื้อง
//   (`\n ` ในสตริงที่ไม่ได้ตามหลัง `,`/`[` เคยเริ่มสมาชิกปลอม)
//   key ห้ามอยู่หลัง `[` (`'[`'` ในค่าเคยเริ่ม key ปลอมที่ข้ามบรรทัด)
const KEY_EXCLUDED = (quote: string) => `(?!${KEY_NAMES}${quote}\\s*(?::|=>)\\s*(?![\\s\\[]))` // key PII (ยกเว้นค่า array ที่ไม่ผ่านกิ่ง array)
// key ใน ' ห้ามข้ามบรรทัดของโครงสร้างที่ escape (`\n` + เยื้อง + `]` `}` — บรรทัดปิด array/object) — re-review #562 รอบ 4: สมาชิก `'\\\\'` ในชั้น 2
// (backslash จริง = \' ของชั้น 3) เคยถูกอ่านเป็น key ที่ข้ามบรรทัด `\n  ],\n  postal_code: '` แล้วกลืน quote เปิดของค่า PII
// และ \' ที่ตามด้วย `,` `]` `}` ไม่นับเป็นเนื้อหา (คือ quote ปิดของสมาชิก `'\\\\'` ในชั้นที่ไม่รู้ — ไม่ใช่ key)
const KEY_LINE_GUARD = `(?!${BS}+n[ \\t]*[\\]}])`
const KEY_CLOSE = `(?:\\12\\12${BS}${BS})*\\12\\13`
const KEY_TOKEN = `(?:${BS}+[^${BS}\\r\\n]|[^${BS}\\r\\n"])`
// เนื้อหาของ key ใน ' หรือ backtick: token = ช่วง backslash + อักขระ หรืออักขระเดียว — ห้ามข้ามบรรทัดปิดที่ escape และห้ามข้าม quote ที่ไม่มี backslash นำ
// key หลายท่อน (Map key ที่มี newline — inspect เขียน `'…\n' +\n  '…' =>`): quote ปิด + `+` + quote เปิดเป็นเนื้อหา (re-review #562 รอบ 6)
// close = quote ปิดตามชั้นที่อ่านได้ (ช่วง backslash + quote ที่ไม่ใช่ quote ปิดเป็นเนื้อหา); close = "" → key ที่ไม่รู้ชั้น (inline):
// \' ที่ตามด้วย `,` `]` `}` `:` `=>` อาจเป็น quote ปิดของสมาชิก/ของ key ที่ลงท้ายด้วย backslash จึงห้ามข้าม (ไม่จับเป็น field)
const SQ_KEY_CONTENT = (q: string, close = "") =>
  `(?:${q}(?:\\s|${BS}+n)*\\+(?:\\s|${BS}+n)*${q}|${KEY_LINE_GUARD}(?:${BS}+[^${BS}\\r\\n'\`]|${close ? `(?!${close})${BS}+['\`]` : `${BS}+['\`](?!\\s*(?:[,\\]}:]|=>))`}|(?!${q})[^${BS}\\r\\n]))*?`
const SQ_CLOSE_ESC = `(?:\\14\\14\\14\\14)*\\15` // ชั้น k ≥ 1: newline นำหน้า = backslash N ตัว + n, quote ปิดมี backslash 4N·m ตัว
const SQ_CLOSE_RAW = `(?:${BS}${BS})*\\16` // ชั้น 0: newline ดิบนำหน้า, quote ปิดมี backslash 2m ตัว
const NON_PII_FIELD =
  `((?<![A-Za-z0-9_$])(?=${BS}{0,7}["'\`]|[A-Za-z_$])(?<=(?:^|[{,\\[\\n]|${BS}+n)[ \\t]*)` +
  `(?:(?<!\\[[ \\t]*)(?:(${BS}{0,7})(")${KEY_EXCLUDED("\\12\\13")}(?:(?!${KEY_CLOSE})${KEY_TOKEN})*${KEY_CLOSE}` +
  `|(?<=[{,](${BS}+)n[ \\t]*)(['\`])${KEY_EXCLUDED("\\15")}${SQ_KEY_CONTENT("\\15", SQ_CLOSE_ESC)}${SQ_CLOSE_ESC}(?=\\s*(?::|=>))` +
  `|(?<=[{,]\\n[ \\t]*)(['\`])${KEY_EXCLUDED("\\16")}${SQ_KEY_CONTENT("\\16", SQ_CLOSE_RAW)}${SQ_CLOSE_RAW}(?=\\s*(?::|=>))` +
  `|(?<=(?:\\{|(?:(?<![^${BS}]${BS}(?:${BS}${BS})*)['\`]|"|[\\])}\\w]),) )(['\`])${KEY_EXCLUDED("\\17")}${SQ_KEY_CONTENT("\\17")}(?<!${BS})\\17(?=\\s*(?::|=>))` +
  `|${KEY_EXCLUDED("")}[A-Za-z_$][\\w$]*)\\s*(?::|=>)\\s*|(?=${BS}*")(?<=[,\\[](?:\\n|${BS}+n)?[ \\t]*)|(?=['\`])(?<=(?:\\[|(?:(?<![^${BS}]${BS}(?:${BS}${BS})*)['\`]|"|[\\])}\\w]),) |[,\\[](?:\\n|${BS}+n)[ \\t]+)))` +
  `(?:(?=["'\`${BS}\\[])((?:[\\s,+\\[\\]]+|${BS}+n|\\.\\.\\. \\d+ more items?|(?=(${quotedString(20, INSPECT_ESCAPED_QUOTE_FIELD, "\\r\\n")}|-?\\d+(?:\\.\\d+)?(?![\\w.])|(?:null|true|false|undefined)(?![\\w$])))\\19(?=\\s*(?:[,\\]}]|${BS}+n|$)|\\s+\\+(?=(?:\\s|${BS}+n)*(?:['\`]|${BS}*"))))*))?`
export const KEY_VALUE = new RegExp(`${PII_KEY_VALUE}|${NON_PII_FIELD}`, "gi")
const PII_ONLY = new RegExp(PII_KEY_VALUE, "gi")
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

/** แทนค่าของ key PII — groups = group 1–10 (ใช้ได้ทั้งกับ KEY_VALUE และ PII_ONLY; อาร์กิวเมนต์หลังจากนั้นของ replace ไม่ใช้) */
const replacePii = (_match: string, ...groups: unknown[]): string => {
  const [prefix, , bracket, items = "", , , , , quote, escaped] = groups as (string | undefined)[]
  if (bracket) {
    // quote ของสมาชิกตัวแรก (JSON ทั้งระดับ 0 และ pretty-print ยัง parse ได้) — สมาชิกตัวเลขล้วน/ว่าง ไม่มี quote
    const q = /^(?:\s|,|\\+n)*(["'`]|\\+")/.exec(items)?.[1] ?? ""
    return `${prefix}[${q}${REDACTED}${q}]`
  }
  const q = quote ?? (escaped === undefined ? "" : `${escaped}"`)
  return `${prefix}${q}${REDACTED}${q}`
}

/** field ที่ไม่ใช่ PII (group 11 = key, 18 = ค่า ถ้าเป็นสตริง/array) → redact ภายใน key และภายในค่าแยกกัน (match ไม่ข้ามขอบ key/ค่า) */
const replaceKeyValue = (match: string, ...groups: unknown[]): string => {
  const [field, , , , , , , fieldValue] = groups.slice(10, 18) as (string | undefined)[]
  return field === undefined
    ? replacePii(match, ...groups)
    : field.replace(PII_ONLY, replacePii) + (fieldValue ?? "").replace(PII_ONLY, replacePii)
}

/**
 * re-review #562: backtrack stack ของ regex ล้น (RangeError — ข้อความหลาย MB บางรูป เช่น array ที่คั่นด้วย `\n` ที่ escape ยาว)
 * → แทนทั้งข้อความด้วย [REDACTED] (เสีย log บรรทัดนั้นแต่ไม่หลุดและไม่ throw — กิ่ง key PII อย่างเดียวไม่มี guard ของ NON_PII_FIELD จึงหลุดกว่า develop)
 */
export function redactPii(text: string): string {
  let out: string
  try {
    out = text.replace(KEY_VALUE, replaceKeyValue)
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error
    }
    return REDACTED
  }
  return out.replace(EMAIL, REDACTED).replace(THAI_PHONE, REDACTED)
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
