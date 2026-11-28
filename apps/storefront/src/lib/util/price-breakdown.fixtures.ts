// SFUI-24a (spec 01 กฎข้อ 158c, AC-200): fixture ของ cart/order ในรูป payload ของ Store API 2.22.1
// ค่า `total`/`tax_total` คำนวณมือตามสูตรของ `@medusajs/utils` 2.22.1 `dist/totals`:
// - line (`line-item/index.js` getLineItemTotals): r = Σ tax_lines.rate / 100;
//   รวม VAT: total = unit_price × quantity − Σ s × (1 + r), tax_total = (unit_price × quantity ÷ (1 + r) − Σ s) × r
//   ไม่รวม VAT: total = (unit_price × quantity − Σ s) × (1 + r), tax_total = (unit_price × quantity − Σ s) × r
// - s ของ adjustment (`adjustment/index.js:18–24` calculateAdjustmentTotal) = is_tax_inclusive ? amount ÷ (1 + r) : amount
// - shipping method (`shipping-method/index.js`): สูตรเดียวกันโดยใช้ amount แทน unit_price × quantity
//   (adjustment ของค่าส่งไม่มี is_tax_inclusive → s = amount)
// - cart/order total = Σ line total + Σ shipping total (`cart/index.js`; credit_line_total = 0)
// ร้านจริง: THB/region ไทยรวม VAT 7% (seed) — fixture แบบไม่รวม VAT มีไว้ครอบสูตรตามคำตัดสิน owner 2026-11-29

const VAT = [{ rate: 7 }]

const inclusiveTax = (gross: number, rate = 7) => (gross / (1 + rate / 100)) * (rate / 100)

/** (1) รวม VAT ล้วน + flash 30% (อัตโนมัติ): 990 − 297 = 693, ค่าส่ง 10 → 703 */
export const FLASH = {
  currency_code: "thb",
  total: 703,
  promotions: [{ id: "promo_flash", code: "FLASH-SWEATER", is_automatic: true }],
  items: [
    {
      id: "item_sweater",
      unit_price: 990,
      quantity: 1,
      is_tax_inclusive: true,
      requires_shipping: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(693),
      adjustments: [{ code: "FLASH-SWEATER", amount: 297, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (2) โค้ด SAVE50 (fixed ฿50 รวม VAT) บนเสื้อยืด 590 × 2 + ค่าส่ง 10 → 1,180 − 50 + 10 = 1,140 */
export const CODE = {
  currency_code: "thb",
  total: 1140,
  promotions: [{ id: "promo_save50", code: "SAVE50", is_automatic: false }],
  items: [
    {
      id: "item_tshirt",
      unit_price: 590,
      quantity: 2,
      is_tax_inclusive: true,
      requires_shipping: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(1130),
      adjustments: [{ code: "SAVE50", amount: 50, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (3) ไม่รวม VAT ล้วน: 100 × 1 rate 7 → ภาษี 7, total 107 (ไม่มี shipping method) */
export const EXCLUSIVE = {
  currency_code: "thb",
  total: 107,
  promotions: [],
  items: [
    {
      id: "item_b",
      unit_price: 100,
      quantity: 1,
      is_tax_inclusive: false,
      requires_shipping: true,
      tax_lines: VAT,
      tax_total: 7,
      adjustments: [],
    },
  ],
  shipping_methods: [],
}

/** (4) ปน (ตัวอย่าง owner): A 107 รวม VAT, B 100 ไม่รวม VAT, ค่าส่ง 10 รวม VAT → 207 / 10 / ภาษี 7 / 224 */
export const MIXED = {
  currency_code: "thb",
  total: 224,
  promotions: [],
  items: [
    { id: "item_a", unit_price: 107, quantity: 1, is_tax_inclusive: true, tax_lines: VAT, tax_total: 7, adjustments: [] },
    { id: "item_b", unit_price: 100, quantity: 1, is_tax_inclusive: false, tax_lines: VAT, tax_total: 7, adjustments: [] },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/**
 * (5) ปน + โค้ดลดทั้ง order: A รวม VAT ได้ adjustment ไม่ inclusive 10 (บนฐาน A = 10 × 1.07 = 10.7),
 * B ไม่รวม VAT ได้ adjustment inclusive 10.7 (s = 10 → บนฐาน B = 10)
 * A total = 107 − 10.7 = 96.3; B total = (100 − 10) × 1.07 = 96.3 (tax_total 6.3); ค่าส่ง 10 → 202.6
 */
export const MIXED_CODE = {
  currency_code: "thb",
  total: 202.6,
  promotions: [{ id: "promo_order10", code: "ORDER10", is_automatic: false }],
  items: [
    {
      id: "item_a",
      unit_price: 107,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(96.3),
      adjustments: [{ code: "ORDER10", amount: 10, is_tax_inclusive: false }],
    },
    {
      id: "item_b",
      unit_price: 100,
      quantity: 1,
      is_tax_inclusive: false,
      tax_lines: VAT,
      tax_total: 6.3,
      adjustments: [{ code: "ORDER10", amount: 10.7, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (6) อัตโนมัติ + โค้ดบน line เดียวกัน (ร้านจริง flash exclusive — ADR-009): 990 − 297 = 693, โค้ด 50, ค่าส่ง 10 → 653 */
export const AUTO_AND_CODE = {
  currency_code: "thb",
  total: 653,
  promotions: [
    { id: "promo_flash", code: "FLASH-SWEATER", is_automatic: true },
    { id: "promo_save50", code: "SAVE50", is_automatic: false },
  ],
  items: [
    {
      id: "item_sweater",
      unit_price: 990,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(643),
      adjustments: [
        { code: "FLASH-SWEATER", amount: 297, is_tax_inclusive: true },
        { code: "SAVE50", amount: 50, is_tax_inclusive: true },
      ],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (7) ส่วนลดค่าส่ง 100%: adjustment ค่าส่ง (ไม่มี is_tax_inclusive) = 10 ÷ 1.07 → บนฐานค่าส่ง = 10 → total 590 */
const shippingDiscounted = (code: string, is_automatic: boolean) => ({
  currency_code: "thb",
  total: 590,
  promotions: [{ id: `promo_${code}`, code, is_automatic }],
  items: [
    {
      id: "item_tshirt",
      unit_price: 590,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(590),
      adjustments: [],
    },
  ],
  shipping_methods: [
    {
      amount: 10,
      is_tax_inclusive: true,
      tax_lines: VAT,
      total: 0,
      tax_total: 0,
      adjustments: [{ code, amount: 10 / 1.07 }],
    },
  ],
})
export const FREE_SHIPPING_CODE = shippingDiscounted("FREESHIP", false)
export const FREE_SHIPPING_AUTO = shippingDiscounted("AUTOSHIP", true)

/** (8) qty 3 ส่วนลดอัตโนมัติ across ฿100 ที่ต่อชิ้นไม่ลงตัว: 100 × 3 − 100 = 200 (66.666…/ชิ้น), ค่าส่ง 10 → 210 */
export const ACROSS_THIRDS = {
  currency_code: "thb",
  total: 210,
  promotions: [{ id: "promo_auto100", code: "AUTO100", is_automatic: true }],
  items: [
    {
      id: "item_mug",
      unit_price: 100,
      quantity: 3,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(200),
      adjustments: [{ code: "AUTO100", amount: 100, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (9) group buy: `GB-ABC` (is_automatic: false) และ `GB-XYZ` ที่ไม่พบใน promotions → อัตโนมัติทั้งคู่ */
export const GROUP_BUY = {
  currency_code: "thb",
  total: 1610,
  promotions: [{ id: "promo_gb", code: "GB-ABC", is_automatic: false }],
  items: [
    {
      id: "item_gb1",
      unit_price: 1000,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(800),
      adjustments: [{ code: "GB-ABC", amount: 200, is_tax_inclusive: true }],
    },
    {
      id: "item_gb2",
      unit_price: 900,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(800),
      adjustments: [{ code: "GB-XYZ", amount: 100, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (10) code ที่ไม่มีใน promotions (เช่น promotion ถูกลบ) → นับเป็นโค้ด: 590 − 30 + 10 = 570 */
export const UNKNOWN_CODE = {
  currency_code: "thb",
  total: 570,
  promotions: [],
  items: [
    {
      id: "item_tshirt",
      unit_price: 590,
      quantity: 1,
      is_tax_inclusive: true,
      tax_lines: VAT,
      tax_total: inclusiveTax(560),
      adjustments: [{ code: "GONE30", amount: 30, is_tax_inclusive: true }],
    },
  ],
  shipping_methods: [
    { amount: 10, is_tax_inclusive: true, tax_lines: VAT, total: 10, tax_total: inclusiveTax(10), adjustments: [] },
  ],
}

/** (11) ไม่รวม VAT สองรายการ rate 7 และ 10 → ภาษี 7 + 20 = 27, total 327 (ป้ายไม่มี %) */
export const TWO_RATES = {
  currency_code: "thb",
  total: 327,
  promotions: [],
  items: [
    { id: "item_b", unit_price: 100, quantity: 1, is_tax_inclusive: false, tax_lines: VAT, tax_total: 7, adjustments: [] },
    {
      id: "item_c",
      unit_price: 200,
      quantity: 1,
      is_tax_inclusive: false,
      tax_lines: [{ rate: 10 }],
      tax_total: 20,
      adjustments: [],
    },
  ],
  shipping_methods: [],
}

/** (12) digital-only (บัตรกำนัล) ไม่มี shipping method → ค่าจัดส่ง 0 */
export const DIGITAL_ONLY = {
  currency_code: "thb",
  total: 500,
  promotions: [],
  items: [
    {
      id: "item_voucher",
      unit_price: 500,
      quantity: 1,
      is_tax_inclusive: true,
      requires_shipping: false,
      tax_lines: VAT,
      tax_total: inclusiveTax(500),
      adjustments: [],
    },
  ],
  shipping_methods: [],
}
