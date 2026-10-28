# รายงาน QA — AF-14 (PR #187)

Spec: `docs/spec/05-affiliate.md` กฎ 38, AC-45 (regression AC-26, AC-42..44) — ทดสอบที่ head `6e7162c` บน prod build (`medusa start`) ใน worktree ของ qa, viewport 1280×800
CI run ของ PR: https://github.com/techpowerdev/medusa-ecom/actions/runs/40603487632 (ทุก job SUCCESS; Playwright report/trace ฉบับเต็มเป็น artifact ของ run นี้ เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-45 (API) `?id[]=A&id[]=B` → A,B `count=2`; `?id=A` → A; รูป `id[0]=` ของ JS SDK + `fields=id,name,email`; id ที่ไม่มี → `count=0`; ไม่มี token → 401 | pass | spec QA `AC-45 (API)` (ผล test) |
| AC-45 (e2e) Ledger แสดงชื่อ + อีเมล ไม่ใช่ `aff_…`; หน้า 1 มี 20 แถวจาก 2 คน → `GET …affiliates?id[…]` 1 ครั้ง `limit=2` | pass | qa-01-ledger-page1-dup-rows.png |
| AC-45 (e2e) Next → หน้า 2: 1 request `limit=4` (= id ไม่ซ้ำ); affiliate ที่ soft-delete และ id ที่ไม่มีอยู่ → แสดง `affiliate_id` เดิม; Prev → 0 request (ใช้ cache ของ Tanstack Query ≤ 1 ครั้งต่อหน้า) | pass | qa-02-ledger-page2-deleted-missing.png |
| AC-45 (e2e) Payouts: คอลัมน์ Affiliate อยู่ถัดจากคอลัมน์ปุ่ม Mark paid/Cancel, ปุ่มและชื่ออยู่ในจอ 1280 px, 1 request ต่อหน้า `limit` = จำนวน id | pass | qa-03-payouts-1280x800.png |
| approve → suspend affiliate ในแท็บ Affiliates แล้วกลับไป Ledger/Payouts → ชื่อ/อีเมลยังถูก | pass | qa-04-ledger-after-approve-suspend.png |
| AC-45 e2e ของ builder (`affiliate-admin-names.spec.ts`) | pass | ผล test (prod build ในเครื่อง qa) |
| AC-26 regression (`affiliate-admin-payouts.spec.ts`) | pass | ผล test |
| AC-42 regression (`affiliate-admin-programs.spec.ts`) | pass | ผล test |
| AC-43 regression (`affiliate-admin-affiliates.spec.ts`) | pass | ผล test |
| AC-44 regression (`affiliate-admin-payout-create.spec.ts`) | pass | ผล test |

ผลรวม: regression 5/5 passed (26.4s), spec QA 4/4 passed (11.3s)

## Negative / edge case
| กรณี | ผล |
|------|----|
| affiliate คนเดียวกันซ้ำหลายแถวในหน้าเดียว (10 แถว × 2 คน) | id ไม่ซ้ำ → `limit=2`, request เดียว — pass |
| affiliate ถูกลบ (`deleted_at`) | แสดง `aff_…` เดิม ไม่ error — pass |
| `affiliate_id` ที่ไม่มีใน DB | แสดง id เดิม; API คืน `count=0` สถานะ 200 — pass |
| หน้าว่าง (ซ่อน entry/payout ทั้งหมดชั่วคราว) | แสดง "No commission entries yet" / "No payouts yet" และไม่มี request `id[]` เลย — pass |
| เรียก API โดยไม่มี token admin | 401 — pass |

## ข้อสังเกต (ไม่ใช่ defect)
- ระหว่างที่ชื่อยังโหลดไม่เสร็จ ตารางจะแสดง `affiliate_id` ชั่วครู่ ซึ่งตรงกับที่ spec/โค้ดตั้งใจ
- ตอนตรวจ PR ยังไม่ได้ sync กับ `origin/develop` ล่าสุด — session หลัก sync แล้วรอ CI ใหม่ก่อน merge

## Defect
ไม่พบ
