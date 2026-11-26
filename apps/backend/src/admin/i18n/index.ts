// spec 10 กฎ 1–2 (ADR-031 ข้อ 2): คำแปลของหน้า admin ที่เราเขียนเอง — dashboard รวมเข้ากับ resource ของ Medusa (deepMerge)
// namespace ของเรา 4 ตัว (ห้ามใช้ `translation` — จะทับข้อความของ Medusa); แต่ละ task แก้เฉพาะไฟล์ json ของ namespace ตัวเอง
// ห้ามเรียก t ในไฟล์นี้หรือตอนโหลด module ใดๆ (กฎ 4c) — browser import โมดูลนี้ก่อน dashboard init i18n
import enAffiliate from "./json/en/ecom-affiliate.json" with { type: "json" }
import enCommon from "./json/en/ecom-common.json" with { type: "json" }
import enEvoucher from "./json/en/ecom-evoucher.json" with { type: "json" }
import enGroupBuy from "./json/en/ecom-group-buy.json" with { type: "json" }
import thAffiliate from "./json/th/ecom-affiliate.json" with { type: "json" }
import thCommon from "./json/th/ecom-common.json" with { type: "json" }
import thEvoucher from "./json/th/ecom-evoucher.json" with { type: "json" }
import thGroupBuy from "./json/th/ecom-group-buy.json" with { type: "json" }

export default {
  en: {
    "ecom-common": enCommon,
    "ecom-group-buy": enGroupBuy,
    "ecom-evoucher": enEvoucher,
    "ecom-affiliate": enAffiliate,
  },
  th: {
    "ecom-common": thCommon,
    "ecom-group-buy": thGroupBuy,
    "ecom-evoucher": thEvoucher,
    "ecom-affiliate": thAffiliate,
  },
}
