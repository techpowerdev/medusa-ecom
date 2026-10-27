# EV-7b — รายงาน QA (PR #179)

Spec: `docs/spec/02-evoucher.md` (AC-6, AC-36; กฎข้อ 22, 23) · commit `7e7c0e5` · ตรวจบน prod build (`medusa start` + `next start`) DB/Redis แยก, Stripe key ปลอม
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40563032340 (Playwright report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` 14 วัน)
ผล: e2e ของ builder `evoucher-storefront.spec.ts` 2/2, QA spec (ในเครื่อง ไม่ได้ commit) 6/6

| AC | Result | Evidence |
|----|--------|----------|
| AC-6 | pass | 02-my-vouchers.png, qa-02-voucher-card-375px.png, qa-03-vouchers-empty-375px.png; e2e (AC-6 + AC-36) และ QA: B เห็น 1 ใบ ไม่มี code ของ A, ไม่ล็อกอิน → `login-page`, heading ไทย |
| AC-36 | pass | 01-pdp-partner-block.png, qa-01-pdp-partner-block-logo-terms.png; บล็อกมีชื่อพาร์ทเนอร์+ไทย, `t-shirt` ไม่มีบล็อก, การ์ดแสดง code/พาร์ทเนอร์/วันหมดอายุ, clipboard = code |

## Checklist ของ PR
| รายการ | ผล |
|--------|----|
| บล็อก PDP: ชื่อ, วิธีใช้, ระยะเวลาใช้งาน, `evoucher-delivery-note` ไทย; โลโก้และ `evoucher-terms-link` (`target=_blank`, `rel=noopener`) | pass |
| variant ผสม (มี pool / ไม่มี): `?v_id=` และ `option-button` → บล็อกหาย/กลับมาตาม variant; `t-shirt` ไม่มีบล็อก | pass |
| `vouchers-link` ใน `account-nav` (desktop) และ `mobile-account-nav` (375px) → `/th/account/vouchers` | pass |
| `voucher-card`: `voucher-code`, `voucher-pin` ตรงกับที่ import, `voucher-expires-at` ไทย, `<details>` วิธีใช้; ลูกค้าที่ไม่มี code เห็น `vouchers-empty` ไทย | pass |
| `voucher-copy-button` → "คัดลอกแล้ว", clipboard = code (dblclick/คลิกซ้ำยังถูก) | pass |
| 375px: code ยาว 88 ตัวอักษรตัดบรรทัดใน card และหน้าไม่มี horizontal scroll | pass |

## Security
| การตรวจ | ผล |
|---------|----|
| HTML และ RSC payload ของ PDP (มี/ไม่มี `v_id`), `/th`, `/th/store`, `/th/account`, หน้า orders ไม่มี code/PIN | pass |
| `GET /store/products` ด้วย fields ที่พยายามขอ `evoucher_pool.codes.code/pin` ไม่คืน code/PIN | pass |
| ยิง `/th/account/vouchers` สลับผู้ใช้ A→B→A→B→ไม่ล็อกอิน→A ทั้ง HTML และ RSC: แต่ละ response มีเฉพาะ code ของตัวเอง | pass |
| header `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, ไม่มี `x-nextjs-cache: HIT` | pass |
| browser เดิมเปลี่ยน cookie จาก B → A แล้วไม่มี code ของ B ค้าง | pass |

## Negative / edge case (นอก spec)
| กรณี | ผล |
|------|----|
| `?v_id=` ที่ไม่มีอยู่ → fallback เป็น variant ตั้งต้น แสดงบล็อก 1 อัน | pass (ตรงพฤติกรรม ProductActions) |
| ชื่อพาร์ทเนอร์เป็น HTML/script → แสดงเป็นข้อความ ไม่ execute | pass |
| `terms_url: "javascript:…"` → admin API รับค่า (200); React 19 บล็อก href ไม่มี XSS แต่ลิงก์เสีย | ข้อสังเกต (backend EV-7a นอกขอบเขต): validator ควรรับเฉพาะ http(s) — follow-up |
| กดปุ่มคัดลอกซ้ำ/ดับเบิลคลิก | pass |

## สรุป
ไม่พบ defect ที่ block PR นี้
