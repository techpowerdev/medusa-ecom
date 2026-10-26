// CORE-18 (spec 01 กฎข้อ 33): เนื้อหาร้านที่ผู้ใช้เห็น รวมไว้ที่ไฟล์เดียว
// ข้อความไทยเขียนตรงในโค้ด (ADR-014) — ไม่มี "server-only" เพื่อให้ client component ใช้ได้
//
// TODO(owner-content): ค่าทั้งหมดในไฟล์นี้เป็น placeholder (owner ตัดสิน 2026-10-26)
// owner ส่งเนื้อหาจริงแล้วแก้ค่าที่นี่ได้เลย ไม่ต้องแก้ component
export const STORE_CONTENT = {
  // ชื่อร้าน: nav, footer, checkout, <title>, JSON-LD
  name: "ร้านค้าของเรา",
  // meta description เริ่มต้นของทั้งเว็บ
  description: "เลือกซื้อสินค้าออนไลน์ ชำระเงินสะดวก จัดส่งทั่วประเทศไทย",
  hero: {
    title: "ยินดีต้อนรับสู่ร้านค้าของเรา",
    subtitle: "สินค้าคัดสรรคุณภาพ ส่งตรงถึงบ้านคุณ",
    ctaLabel: "เลือกซื้อสินค้า",
    ctaHref: "/store",
  },
  footer: {
    tagline: "ช้อปง่าย จ่ายสะดวก ส่งไวทั่วประเทศ",
  },
  // ข้อความแจ้งบนหน้านโยบายที่ยังเป็นเนื้อหาตัวอย่าง
  policyPlaceholderNotice:
    "เนื้อหาหน้านี้เป็นข้อความตัวอย่าง ร้านจะปรับปรุงเป็นข้อมูลจริงก่อนเปิดให้บริการ",
} as const

export const STORE_NAME = STORE_CONTENT.name
