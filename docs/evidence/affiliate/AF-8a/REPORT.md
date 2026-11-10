# QA — AF-8a portal affiliate (PR #135)

- Spec: `docs/spec/05-affiliate.md` (AF-8, AC-9, AC-35, กฎ 17, 29, Q6) + ADR-014
- prod build backend :9186 / storefront :8186, Stripe key ปลอม, prod guard OPS-7

## รอบที่ตรวจ
| รอบ | Commit | e2e ของ PR | QA spec | regression | CI |
|-----|--------|-----------|------|-----------|----|
| 1 | `3356b93` | 2/2 ผ่าน | 4/6 ผ่าน (ล้มคือ D1, D2) | `affiliate-tracking` 1/1, Vitest 87/87 | [run 40474608771](https://github.com/techpowerdev/medusa-ecom/actions/runs/40474608771) success |
| 2 | `f45cf7e` (รวม `ec9f201`) | 4/4 ผ่าน | 6/6 ผ่าน | `affiliate-tracking` 1/1, Vitest 97/97 | [run 40476753126](https://github.com/techpowerdev/medusa-ecom/actions/runs/40476753126) success |

report/trace ฉบับเต็มอยู่ใน CI artifact ของ run 40476753126 (14 วัน) screenshot ทุกรูปจากรอบ 2

## Acceptance criteria (รอบ 2, `f45cf7e`)
| AC | Result | Evidence |
|----|--------|----------|
| AC-9 แท็บ `affiliate-tab-earning`/`affiliate-tab-upcoming` เป็นไทย การ์ดมี % และวันที่ | pass | 01-earning-tab.png, 02-upcoming-tab.png |
| AC-9 ปุ่ม `affiliate-share-button` คัดลอกลิงก์ `/r/<code>?to=/products/<handle>` | pass | 04-share-copied.png |
| AC-35 การ์ดเดียวต่อสินค้า, `rate_varies` แสดง "สูงสุด 15%" และ "ได้ประมาณสูงสุด"; แท็บ upcoming การ์ดเดียว | pass | 01-earning-tab.png, 02-upcoming-tab.png |
| กฎ 17 token อยู่ใน httpOnly cookie แยกจาก customer | pass | qa e2e `security` |
| Q6 pending เห็นข้อความรออนุมัติ ไม่เห็นสินค้า | pass | 03-pending.png |
| Q6 suspended เห็นข้อความระงับ ไม่มีแท็บ/การ์ด | pass | qa e2e + e2e ของ PR |

## Checklist ของ PR (รอบ 2)
| รายการ | Result |
|--------|--------|
| ยังไม่ login → `/th/affiliate/login` | pass |
| customer เข้า portal ไม่ได้ (ทุกทาง รวมกรอกรหัสของ customer → ข้อความไทย) | pass |
| affiliate เข้า `/account` ไม่ได้; API ข้าม actor ได้ 401 ทั้งสองทาง | pass |
| การ์ดเดียวต่อสินค้า / "สูงสุด X%" / ยอดประมาณการ | pass |
| แท็บ upcoming "เริ่มในอีก N วัน" และแชร์ได้ | pass |
| Web Share / คัดลอกลิงก์ / กดรัวเขียนครั้งเดียว | pass |
| เปิดลิงก์ที่คัดลอก → หน้าสินค้า + cookie `aff` httpOnly | pass |
| สมัครใหม่ → รออนุมัติ; logout → login | pass |
| no-JS: login และแท็บใช้ได้ | pass |
| มือถือ 375px ไม่ล้น | pass (05-mobile-375.png) |

## Defect
| ID | ความรุนแรง | รอบ 1 (`3356b93`) | รอบ 2 (`f45cf7e`) |
|----|-----------|------------------|------------------|
| D1 กรอกรหัสของ customer ที่ยังไม่เป็นแอฟฟิลิเอต | minor | fail: เด้งกลับหน้า login ไม่มีข้อความ cookie ค้าง (ไม่รั่ว) | แก้แล้ว: ข้อความไทย ไม่มี `_affiliate_jwt` |
| D2 `/th/affiliate?page=1.5` | minor | fail: HTTP 500 | แก้แล้ว: 1.5/abc/-3/99999 ได้ 200 |

ไม่พบ defect ค้างในรอบ 2

## ข้อสังเกต
- นับถอยหลังปัดขึ้น โปรแกรมที่เริ่มในไม่กี่ชั่วโมงแสดง "เริ่มในอีก 1 วัน"
- `rate_varies` ใช้ยอดประมาณการ = ราคาต่ำสุด × อัตราสูงสุด (รอ planner ยืนยัน)
