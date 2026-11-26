# ROADMAP — milestone, ลำดับ PR, สถานะ

อัปเดตล่าสุด: 2026-11-27 (รอบ 46 admin ภาษาไทย ☑ merge ครบ #593–#597 — spec 10, ADR-031; รอบ 44 ☑ #565–#581, รอบ 45 ☑ #583–#590; ยังไม่ release) · ไฟล์นี้เก็บเฉพาะ "ตอนนี้" — ประวัติรายรอบ/ตาราง task ทุกตัวอยู่ที่
[`docs/roadmap/history.md`](roadmap/history.md) และ follow-up เก่า (รอบ 13–39) อยู่ที่
[`docs/roadmap/followups-archive.md`](roadmap/followups-archive.md)

## สรุปสถานะ (อ่านตรงนี้ก่อน)

- **ตอนนี้**: **release v0.3.1 แล้ว (2026-11-25)** — #561 `develop → main` (merge commit `88bb0b63`, tag `v0.3.1`): รอบ 42 (21 task) +
  รอบ 43 ส่วน v0.3.1 (OPS-36 #554, PAY-23 #555, PAY-24 #556, OPS-39 #559) เป็น 🚀 · OPS-40 (PII ค่าเดี่ยวจาก review #559) ☑ #562 (merge 2026-11-26 — ข้อยกเว้น d1/d2/d3 ของกฎ 22d + กรณีรู้แล้ว `cart_13rjFZ` → OPS-41), **ไม่อยู่ใน v0.3.1**
- **ยังไม่ release หลัง v0.3.1**: OPS-40 + รอบ 44 (SFUI, 16 task) + รอบ 45 (7 task) + รอบ 46 (admin ไทย, 4 task — ☑ 2026-11-27) อยู่ใน `develop` เท่านั้น ·
  owner **ยังไม่ go-live** (release `develop → main` เป็นของ owner)
- **รอบปัจจุบัน**: ไม่มี — รอบ 46 ปิดแล้ว ไม่มี PR งานค้าง; รอบ 43 กลุ่ม "หลัง go-live" (14 task) รอ owner สั่ง
- **รอ owner ตัดสิน**: ไม่มีคำถามค้างของรอบ 43 — เหลือเฉพาะเรื่องก่อน go-live (Stripe live, ค่าส่ง, staging); รอบ 44: ไม่มีคำถามค้าง (ADR-030 accepted, Q1/Q2 ตอบแล้ว 2026-11-26); รอบ 45: ไม่มีคำถามค้าง (owner สั่ง "เก็บต่อเลย" 2026-11-26);
  รอบ 46: ไม่มีคำถามค้าง (ADR-031 accepted, Q1 = ก 2026-11-26)
- **ขั้นต่อไป**: go-live (checklist ข้อ 1–16) → **v1.0.0** (ร้านเปิดจริงครั้งแรก)

### Release

| Release | สถานะ | วันที่ | PR / tag | เนื้อหาหลัก |
|---|---|---|---|---|
| v0.1.0 | 🚀 | 2026-11-11 | #342 (`15fce017`), tag `v0.1.0` | ร้านค้าหลัก + task ทุกตัวที่ merge ถึงวันนั้น (เงื่อนไข: CORE-12/12b/17/18, OPS-21, EV-15, CORE-55) |
| v0.2.0 | 🚀 | 2026-11-19 | #423 (`e274d387`), tag `v0.2.0` | task ใน milestone/Admin UI ที่ merge หลัง v0.1.0 ถึงรอบ 39 |
| v0.3.0 | 🚀 | 2026-11-24 | #521 (`47c3e545`), tag `v0.3.0`, [GitHub Release](https://github.com/techpowerdev/medusa-ecom/releases/tag/v0.3.0) | แก้จากการทดสอบ manual (รอบ 40 = 32 task) + รอบ 41 (36 task; PAY-13 ✕) |
| v0.3.1 | 🚀 | 2026-11-25 | #561 (`88bb0b63`), tag `v0.3.1` | รอบ 42 (21 task 🚀 — history หัวข้อ "รอบ 42 — ผลจริง") + 4 task ก่อน go-live ของรอบ 43 (3 🚀 train #557 + OPS-39 🚀 #559; Q-R43-ฉ = ก แก้เพิ่ม + OPS-39 owner 2026-11-25) |
| (ยังไม่ release) | ☑ ใน develop | — | — | OPS-40 #562 + รอบ 44 (#565–#581) + รอบ 45 (#583–#590) + รอบ 46 (#593–#597) — รอ owner |
| go-live | ☐ owner ยังไม่ go-live | — | — | หลัง v0.3.1 + OPS-40 (☑ #562) + Go-live checklist ข้อ 1–16 |
| v1.0.0 | ☐ | — | — | release แรกที่เปิดร้านจริง: Go-live checklist ครบ + smoke test บน production ผ่าน (Q-R43-จ owner 2026-11-25) |
| หลัง go-live | ☐ รอ owner สั่ง | — | — | รอบ 43 อีก 14 task (รวม OPS-41) |

ป้าย release ในหัวข้อ M3–M7 ของ history (v0.3.0 … v1.0.0 🎯) เป็นแผนเดิมก่อนรวม release — ไม่ผูกกับเลข release จริงในตารางนี้

### สัญลักษณ์

☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0 · ∥ ทำขนานได้

- `docs/spec/*.md` คง ☑ = merge เข้า develop แล้ว **ไม่ sync ☑→🚀** — ROADMAP เป็นที่เดียวที่บอกสถานะ release (owner 2026-11-12)
- task ที่ merge หลัง v0.3.1 ใช้ ☑ จนถึง release ถัดไป (v1.0.0) · บันทึกประวัติคงสัญลักษณ์ ณ วันที่บันทึก

## รอบ 43 (ปิดรอบ 42 2026-11-24; owner ตอบ Q-R43 2026-11-25)

ที่มา: follow-up ของ review/qa/builder #524–#551 ที่ยังจริงบน develop `599009b6` · เลขกฎ/AC อยู่ในหัวข้อ "Follow-up รอบ 43" ของแต่ละ spec ·
Depends "—" = เฉพาะ PR เอกสารปิดรอบ 42 · ทุกตัวขนานกันได้ (∥) เว้นที่ระบุ

### ก่อน go-live → v0.3.1 (🚀 release 2026-11-25, #561)

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| OPS-36 | 07 | (PII) redact: ค่าลงท้าย backslash ไม่ทำให้ key ถัดไปหลุด + หลายท่อน | — | — | 🚀 #554 |
| PAY-23 | 06 | (เงิน) alert คืนเงิน: `source`, prefix log, เรียงใหม่ก่อน (Q-P23 = ก), `order_id` | — | — | 🚀 #555 |
| PAY-24 | 06 | (เงิน) ผู้ส่ง `OPS_ALERT_EMAIL` 3 ที่ใช้ `sendOpsAlert` | — | — | 🚀 #556 |
| OPS-39 | 07 | (PII) redact: `\'` ของ inspect ใน JSON escape 1–3 ชั้น + ค่า array ของ key PII + fuzz/ReDoS (owner 2026-11-25) | PR เอกสาร OPS-39 | — | 🚀 #559 |

OPS-36, PAY-23, PAY-24 merge ใน train #557 · OPS-39 เพิ่มหลัง train (review #554) #559 — release ใน v0.3.1 (#561)

### ก่อน go-live — ไม่อยู่ใน v0.3.1 (owner สั่งทำแล้ว 2026-11-25)

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| OPS-40 | 07 | (PII) redact ค่าเดี่ยว: รูปเปิด key PII ในค่าอื่นไม่ทำให้ key ถัดไปหลุด + `\'` ที่มี `<pii-key>:` + fuzz สองทิศ/ReDoS (review #559) | PR เอกสาร OPS-40 | — | ☑ #562 |

ไม่อยู่ใน v0.3.1 (release ไปก่อนแล้ว) · ต้อง merge ก่อน go-live (ข้อ 13) · ∥ งานหลัง go-live ทุกตัว · `redact-pii.ts` ไม่มี task อื่นแตะ

### หลัง go-live (☐ รอ owner สั่ง)

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| CORE-96 | 01 | สรุปขั้น payment ไม่ตัดคำทุกความกว้าง + บัตรของขวัญ + `renewedFrom` | — | ✓ | ☐ |
| CORE-97 | 01 | nav ตะกร้า: ลิงก์ไม่ซ้อนปุ่ม, ป้ายไม่ค้างหลัง logout, backend ล่มไม่บอก (0) — ⚠️ ชน SFUI-3c (`cart-dropdown` → Radix `Popover`); ตัวที่ merge ทีหลังต้องเขียน static check ของ AC-194 ใหม่ให้อ้าง `PopoverAnchor` แทน `PopoverButton` (SFUI-3c ครอบลิงก์ `nav-cart-link` ด้วย `PopoverAnchor` — spec 09 กฎ 4b) | — | ✓ | ☐ |
| CORE-98 | 01 | overview GB-8 ล้ม/`<ul>` ว่าง + a11y `SearchPagination` + จำนวน toggle ลดราคา | — | ✓ | ☐ |
| CORE-99 | 01 | a11y ลิงก์/ปุ่ม: static ครอบทุกรูป, "." ปุ่มสลับ, testid `cart-sign-in-link` | — | ✓ | ☐ |
| CORE-100 | 01 | hygiene storefront: purity 3 ไฟล์, coverage/`COMPARE`, e2e chip, unit กฎ 151e | — | — | ☐ |
| FS-26 | 03 | e2e hygiene flash: `stripeRefunds`/`ok` ร่วม + catch ของ helper | — | — | ☐ |
| GB-33 | 04 | test hygiene: filter ของ AC-69b, เกณฑ์เวลาผูก `LOCK_TIMEOUT`, comment | — | — | ☐ |
| PAY-22 | 06 | `/api/payment-return`: `FAILED`, failed+401 → `step=payment`, notice เมื่อ `succeeded` (Q-P21 = ก) | — | — | ☐ |
| PAY-25 | 06 | ข้อความไทยของ error Stripe ตอนเปิด QR + หน้าจ่าย order | — | ✓ | ☐ |
| OPS-37 | 07 | runbook หลัง go-live (คำสั่ง DELETE) + log backend เต็มเป็น artifact CI | — | — | ☐ |
| OPS-38 | 07 | backend lint warning 4 ไฟล์ (ไม่เปลี่ยน id ของ step/workflow) | — | — | ☐ |
| ADM-49 | 08 | focus หลัง Mark as paid → แถวถัดไป/ปุ่ม Create payout | — | ✓ | ☐ |
| ADM-50 | 08 | test hygiene admin: static ผูกปุ่ม Save, unit hook, e2e campaign | — | — | ☐ |
| OPS-41 | 07 | (PII) `redactPii` แบบ parser นับความลึกวงเล็บ/ชั้น escape แทน regex — ปิดข้อยกเว้น d1/d2/d3 ของกฎ 22d + กรณีรู้แล้ว `cart_13rjFZ` (owner 2026-11-26; fixture ที่ `docs/spec/fixtures/OPS-41/`) | OPS-40 ☑ #562, spec/ADR ของ OPS-41 | — | ☐ |

- **ไฟล์ร่วม** (ตัวที่ merge ทีหลัง sync): `docs/ops/production.md` PAY-23 → OPS-37 · `components/common/*` ADM-49 ↔ ADM-50 ·
  static ของ CORE-99 พบจุดใน nav → ให้ CORE-97 แก้ · `ci.yml` OPS-37 เท่านั้น · `cart.ts` CORE-97 เท่านั้น
- integration หนัก: GB-33 — จำกัดพร้อมกันตามเครื่อง
- ไม่ทำ/backlog ของรอบนี้ (พร้อมเหตุผล): history หัวข้อ "รอบ 42 — ผลจริง"

## รอบ 44 — storefront เป็น shadcn/ui (spec 09, ADR-030) (☑ merge ครบ 2026-11-26: #565 docs → #566…#581)

ที่มา: owner 2026-11-26 — แทนชั้น UI ของ Medusa ใน storefront ทั้ง 4 ชั้น, อัป Tailwind v4 ก่อน, หน้าตาเปลี่ยนได้แต่คงสี brand (ADR-008) ·
ADR-030 accepted 2026-11-26 · **stack** (owner อนุญาต 2026-11-26 — ข้อยกเว้นของ "ห้ามแตก branch จาก PR ที่ยังไม่ merge" เฉพาะชุด SFUI): แต่ละ task แตก branch ต่อจาก branch
ของ Depends (เริ่มจาก `docs/SFUI-shadcn-adr-spec`) ไม่ต้องรอ merge → เปิด PR ทั้งชุดตอนท้าย (base = `develop`) → merge ตามลำดับ · แต่ละไฟล์มี task เจ้าของเดียว (ตาราง Tasks ของ spec 09) · admin ไม่กระทบ

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| SFUI-1a | 09 | Tailwind v4 (CSS-first `@theme`) + ชั้นเข้ากันได้ `legacy-medusa.css` + ถอด preset/`tailwindcss-radix`/`autoprefixer` + test ฟอนต์/brand ใหม่ + baseline testid/ข้อความไทย + guard `PENDING` + e2e 390px | branch เอกสารรอบ 44 (stack; PR เอกสาร merge ลำดับแรก) | ✓ | ☑ #566 |
| SFUI-1b | 09 | `shadcn init -b radix` (`components.json`, `@/*`, `cn`, token neutral, `--primary`/`--ring` → brand) | SFUI-1a | — | ☑ #567 |
| SFUI-2 | 09 | shadcn button/input/label/badge/table/checkbox/radio-group + shim ส่งต่อ (`isLoading`) | SFUI-1b | ✓ | ☑ #568 |
| SFUI-3a | 09 | modal ที่อยู่ → `Dialog` (ลบ `common/modal`) | SFUI-2 | ✓ | ☑ #569 |
| SFUI-3b | 09 | side menu / search drawer / mobile actions → `Sheet` | SFUI-2 | ✓ | ☑ #571 |
| SFUI-3c | 09 | cart dropdown → `Popover`, country/address select → `Select`, account-info → `Collapsible` | SFUI-2 | ✓ | ☑ #570 |
| SFUI-3d | 09 | ขั้นชำระเงิน → `RadioGroup` + unit 5 ไฟล์เลิก mock headlessui | SFUI-2 | ✓ | ☑ #572 |
| SFUI-3e | 09 | ตัวเลือกจัดส่ง → `RadioGroup` (order-pay ย้ายไป 3d) | SFUI-3d | ✓ | ☑ #573 |
| SFUI-4 | 09 | accordion/slider ของ store + แท็บ PDP → shadcn `Accordion`/`Slider` | SFUI-2 | ✓ | ☑ #574 |
| SFUI-5a | 09 | ย้าย class/icon/import: common + layout + หน้าคงที่ | SFUI-2 | ✓ | ☑ #575 |
| SFUI-5b | 09 | ย้าย class/icon/import: catalog (products/store/home/categories/collections/search) | SFUI-2 | ✓ | ☑ #576 |
| SFUI-5c | 09 | ย้าย class/icon/import: checkout + cart + returns | SFUI-2 | ✓ | ☑ #577 |
| SFUI-5d | 09 | ย้าย class/icon/import: account + order | SFUI-2 | ✓ | ☑ #578 |
| SFUI-5e | 09 | ย้าย class/icon/import: group buy + affiliate + evoucher | SFUI-2 | ✓ | ☑ #579 |
| SFUI-6 | 09 | ลบ shim/radio/ชั้นเข้ากันได้/dependency เก่า, guard ว่าง, CLAUDE.md Stack | SFUI-1a..5e ทั้งหมด | ✓ | ☑ #580 |
| SFUI-7 | 09 | ไฟล์ใน `src/components/ui/` = ผล shadcn CLI ตรงตัว (owner 2026-11-26) — ความสามารถเพิ่มย้ายไป wrapper `src/components/*` + guard hash/`cn` | SFUI-6 | ✓ | ☑ #581 |

- ลำดับตาม Depends: 1a → 1b → 2 → (3a ∥ 3b ∥ 3c ∥ 3d ∥ 4 ∥ 5a..5e; 3e หลัง 3d) → 6 → 7
- ลำดับ merge จริง (stack เรียงเป็นเส้นเดียว, ตามเลข PR): 1a → 1b → 2 → 3a → 3c → 3b → 3d → 3e → 4 → 5a → 5b → 5c → 5d → 5e → 6 → 7
- **ไฟล์ร่วม** (ตัวที่ merge ทีหลัง sync): `e2e/sfui-legacy.unit.spec.ts` (แต่ละ task ลบ key `PENDING` ของตัวเอง) · `package.json`/lockfile แก้เฉพาะ 1a, 1b, 6 · `globals.css` 1a → 1b → 6
- ~~**งด release `develop → main`** ตั้งแต่ SFUI-2 merge จนถึง SFUI-6 merge ยกเว้น hotfix (owner 2026-11-26 — spec 09 Q2)~~ สิ้นสุดแล้ว — SFUI merge ครบ 2026-11-26 · browser ขั้นต่ำของ Tailwind v4 owner ยอมรับ (Q1 — ยังมีผล)

## รอบ 45 — เก็บกวาดหลัง SFUI-7 (spec 09 หัวข้อ "ส่วนเก็บกวาดหลัง SFUI-7", กฎ 22–25, AC-20–AC-25) (☑ merge ครบ 2026-11-26: เอกสาร #583 → #584…#590)

ที่มา: owner 2026-11-26 "เก็บต่อเลย" — (1) เลิกใช้ utility ขนาดฟอนต์ของ starter `text-*-regular/semi` 13 ตัว (~217 จุดใน 81 ไฟล์ของ `src/modules` + `src/app` ณ `b2b27ccc`)
แทนด้วย utility มาตรฐานที่ค่าที่ render เท่าเดิม แล้วลบ `@utility` + `cn` ที่ extend (`createCn`/`FONT_SIZE_UTILITIES`) กลับเป็น `export { cn } from "cn"` ตาม ADR-030 ข้อ 3;
(2) แก้ rule floating label ใน `globals.css` ที่จับ `<label>` อื่น (ป้ายตัวเลือก/จำนวนบน PDP ได้ 10px และเลื่อนขึ้น -12px) — **เปลี่ยนหน้าตา PDP (แก้บั๊ก)** · ไม่มี ADR ใหม่ (อยู่ในกรอบ ADR-030) ·
**stack — วิธีเดียวกับรอบ 44** (owner อนุญาต 2026-11-26): 8 และ 9a–9e แตกจาก branch เอกสาร `docs/SFUI2-font-utilities`, 10 แตกจาก branch ที่รวม 8 + 9a..9e → เปิด PR ทั้งชุดตอนท้าย (base = `develop`) → merge ตามลำดับ ·
แต่ละไฟล์มี task เจ้าของเดียว (ตาราง Tasks รอบ 45 ของ spec 09) · admin ไม่กระทบ · ไม่งด release

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| SFUI-8 | 09 | floating label ผูกเฉพาะ `common/components/input` (`peer-*` แทน rule `input ~ label`); ป้าย PDP ได้ขนาดตาม className (12px/20px) | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #584 |
| SFUI-9a | 09 | แทน `text-*-regular/semi`: common + layout + หน้าคงที่ (ค่าที่ render เท่าเดิม + e2e วัดก่อน/หลัง) | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #585 |
| SFUI-9b | 09 | แทน `text-*-regular/semi`: catalog (products/store/home/categories/collections/search) | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #586 |
| SFUI-9c | 09 | แทน `text-*-regular/semi`: checkout + cart + returns | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #587 |
| SFUI-9d | 09 | แทน `text-*-regular/semi`: account + order | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #588 |
| SFUI-9e | 09 | แทน `text-*-regular/semi`: group buy + affiliate + evoucher | PR เอกสารรอบ 45 (stack) | ✓ | ☑ #589 |
| SFUI-10 | 09 | ลบ `@utility` 13 ตัว, `cn` = `export { cn } from "cn"`, ปรับ test + guard static กัน token กลับมา | SFUI-8, 9a..9e ทั้งหมด | — | ☑ #590 |

- ลำดับ: (8 ∥ 9a ∥ 9b ∥ 9c ∥ 9d ∥ 9e) → 10
- **ไฟล์ร่วม**: `globals.css` 8 → 10 เท่านั้น · กลุ่มขนานไม่มีไฟล์ร่วม (`option-select.tsx`/`product-actions/index.tsx` เป็นของ 9b; SFUI-8 ไม่แตะ)
- ค่าที่คาดใน e2e ของ 9x/8 วัดที่ commit ที่ branch แตกออกมา (ก่อนแก้) ไม่ใช่คำนวณจากชื่อ class — spec ใหม่ของ 9x ต้องผ่านทั้งก่อนและหลังแก้

## รอบ 46 — หน้า admin ของเราเป็นภาษาไทย (spec 10, ADR-031 accepted 2026-11-26) (☑ merge ครบ 2026-11-27: เอกสาร #593 → #594…#597)

ที่มา: owner 2026-11-26 ทาง "ข" — หน้า/widget ใน `src/admin/**` แสดงไทยเมื่อผู้ใช้เลือกไทยใน Settings → Profile ผ่าน i18n ของ Medusa admin ·
"แค่ปรับเพิ่มภาษา" (โหมดอังกฤษเหมือนเดิมทุกตัวอักษร) · task ไม่ย่อยเกินไป (diff เกิน ~400 LOC ได้ — คำแปล/`t()` แบบกลไก) ·
**stack** แบบรอบ 44–45: AI18N-1 แตกจาก `docs/admin-thai-i18n`, AI18N-2..4 แตกจาก branch ของ AI18N-1 → เปิด PR ทั้งชุดตอนท้าย → merge ตามลำดับ · ไม่งด release

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| AI18N-1 | 10 | โครง i18n (4 namespace) + helper `t.ts` + ล็อก `lng=en` ใน e2e admin + guard/parity/unit + prompt ส่วนร่วม + e2e ไทยส่วนร่วม | PR เอกสารรอบ 46 (stack) | ✓ | ☑ #594 |
| AI18N-2 | 10 | แปล group buy + flash sale (`ecom-group-buy`) + e2e ไทย | AI18N-1 (stack) | ✓ | ☑ #595 |
| AI18N-3 | 10 | แปล e-voucher + widget order/variant/refund-blocked (`ecom-evoucher`) + e2e ไทย | AI18N-1 (stack) | ✓ | ☑ #596 |
| AI18N-4 | 10 | แปล affiliate (`ecom-affiliate`) + e2e ไทย; `I18N_PENDING` ว่างทั้งหมด | AI18N-1 (stack) | ✓ | ☑ #597 |

- ลำดับ: 1 → (2 ∥ 3 ∥ 4) · merge จริง 1 → 2 → 3 → 4 (#594 → #597, 2026-11-27) · reviewer APPROVE ทุกตัว, CI เขียว,
  qa ผ่าน AC-1..11 ไม่มี defect (`docs/evidence/admin-i18n/AI18N-{1..4}/REPORT.md`) · nit กฎ 7 แก้ใน PR ปิดรอบ; nit ที่เหลือ (ตัวแปร `t` ซ้อน, camelCase ใน `create-campaign.tsx`, `productStatus.proposed` = "เสนอ", ข้อความ error ของ `evidenceDir`, locator breadcrumb ใน e2e) → task AI18N-N1 (owner สั่ง 2026-11-27)
- **ไฟล์ร่วม**: `src/admin/__tests__/i18n.unit.spec.ts` (แต่ละ task แก้บรรทัด key ของกลุ่มตัวเองใน `I18N_PENDING`) · `medusa-ui.unit.spec.ts` (assertion ของกลุ่มตัวเอง) ·
  `i18n/index.ts`, `e2e/support/admin.ts`, `package.json`/lockfile = AI18N-1 เท่านั้น
- เริ่มได้เมื่อ PR เอกสารรอบ 46 (รวมแก้ CLAUDE.md หัวข้อ Language ตาม ADR-031) พร้อม — stack ไม่ต้องรอ merge · Q1 = ก: ไม่ตั้งไทยเป็นค่าเริ่มต้น (กฎ 15/AC-12 ไม่ทำ)
- จุดเสี่ยงที่ต้องผ่าน (review เอกสาร): ห้ามเรียก `t` ตอนโหลด module (กฎ 4, AC-4c, guard 14f) · jest ใช้ i18next instance แยก ไม่ init instance กลาง (กฎ 16, AC-4b)

## คำถามที่รอ owner

- **รอบ 46**: ไม่มีคำถามค้าง — owner 2026-11-26: ADR-031 = accepted · ~~Q1~~ = ก (ภาษาเริ่มต้นตาม Medusa) · อนุมัติแก้ CLAUDE.md หัวข้อ Language

- **รอบ 45**: ไม่มีคำถามค้าง

- **รอบ 44**: ไม่มีคำถามค้าง — owner 2026-11-26: ADR-030 = accepted · ~~Q1~~ = ยอมรับ browser ขั้นต่ำของ Tailwind v4 · ~~Q2~~ = งด release ระหว่าง SFUI-2..6 (ยกเว้น hotfix — สิ้นสุดแล้ว 2026-11-26) · ทำแบบ stack ได้

- **รอบ 43**: ไม่มีคำถามค้าง — คำตัดสิน owner 2026-11-25:
  - ~~Q-R43-ฉ~~ = ก (owner 2026-11-25) แก้เพิ่ม: 3 task (OPS-36, PAY-23, PAY-24) รวมใน v0.3.1 ไม่แยก v0.3.2 — v0.3.1 รอ 3 task นี้ merge ก่อน owner merge `develop → main`;
    อีก 13 task หลัง go-live (☐ รอ owner สั่ง); owner 2026-11-25 เพิ่ม OPS-39 (PII ที่เหลือจาก review #554) เข้า v0.3.1 ด้วย
    และ OPS-40 (PII ค่าเดี่ยวจาก review #559) ก่อน go-live แต่ไม่อยู่ใน v0.3.1
  - ~~Q-R43-จ~~ = ก: v1.0.0 = release แรกที่เปิดร้านจริง (Go-live checklist ครบ + smoke test บน production ผ่าน); backlog ⏸ คงหลัง v1.0
  - ~~Q-R43-ง~~ = ก: เพิ่มกติกา ROADMAP แบบสั้นใน `.claude/agents/planner.md` ข้อ 5 — session หลักทำใน PR บทเรียน
  - spec 06 ~~Q-P21~~ = ก (PAY-22), ~~Q-P22~~ = คงไว้, ~~Q-P23~~ = เรียงใหม่ก่อน (PAY-23); spec 01 ~~Q-C18~~ = คงไว้
- **follow-up เก่า (รอบ 30–39)**: ข้อ ข/ค (hygiene/backlog) ยังไม่มี task รอ owner สั่ง — [`followups-archive.md`](roadmap/followups-archive.md)
- **ต้องตัดสินก่อน go-live** (คำถามเดิม):
  1. spec 06 Q1 — บัญชี Stripe live นิติบุคคลไทย + เปิด PromptPay + ยื่น account application (Go-live ข้อ 6, 16; owner ยังไม่ยืนยัน)
  2. spec 01 Q-F1 — ค่าส่งจริงแทน ฿10 placeholder (Go-live ข้อ 5)
  3. staging (ADR-027 ยังไม่เขียน) — ต้องมีก่อนวัด checkout แบบ OPS-26 ซ้ำบน staging และก่อน OPS-19 ⏸

## ก่อนเปิดร้านจริง (go-live)

ทำตาม `docs/ops/production.md` หัวข้อ "Go-live checklist" ข้อ 1–16 บน prod (รวม `check:go-live`) โดยเฉพาะข้อที่เพิ่มในรอบ 40–42:

| ข้อ | งาน | ที่มา |
|---|---|---|
| 10 | Postgres prod `LC_CTYPE` ไม่ใช่ `C`/`POSIX` (`check:go-live` ตรวจ) | CORE-75, OPS-33 |
| 11 | รัน `lowercase-emails.ts` แปลงอีเมลเดิมเป็นตัวเล็ก | CORE-80/81 |
| 12 | backfill ธง `evoucher_backordered` | EV-25 |
| 13 | log ของ prod ไม่มี PII (access log ไม่ผ่าน redact — OPS-35; OPS-36 + OPS-39 ของ v0.3.1 ปิดช่องหลัก, `\'` ใน JSON escape และ PII ใน array; OPS-40 ☑ #562 — รูปเปิด key PII ค่าเดี่ยวในค่าอื่น; ช่องที่เหลือ → OPS-41 หลัง go-live) | OPS-33, OPS-35, OPS-36, OPS-39, OPS-40 |
| 14 | วัด p95 `POST /store/search` กับ catalog จริง (> ~10k สินค้าหรือ p95 > 300ms → ADR) | CORE-75 |
| 15 | endpoint live สมัคร `refund.updated`/`refund.failed` + ทดสอบบัตร `4000 0000 0000 5126` ว่า alert ถึง ops | PAY-21, ADR-029 |
| 16 | บัญชี Stripe live ยื่น account application ให้เสร็จ (refund พร้อมเพย์ต้องส่งอีเมลขอบัญชีถึงลูกค้า) | PAY-19 (Q-P14/15), ปิดรอบ 42 |

เพิ่มเติม (ไม่ใช่ task): ข้อ 5–6 ตามคำถามด้านบน · smoke test บน production (`check:go-live` + `tools/ops/smoke-*.sh`) ·
ตั้ง `OPS_ALERT_EMAIL`, `EVOUCHER_ADMIN_EMAIL`, `RESEND_API_KEY` · วัด OPS-26 ซ้ำบน staging (ต้องมี ADR-027 ก่อน)

## Milestone ภาพรวม

รายการ task ทุกตัวพร้อมเลข PR: [`history.md`](roadmap/history.md) (หัวข้อ M0–M7, Admin UI, Release v0.3.0, รอบ 41, รอบ 42 — ผลจริง)

| Milestone | spec | สถานะ | task | หมายเหตุ |
|---|---|---|---|---|
| M0 Scaffold | — | 🚀 | 1/1 | เอกสาร, agents, CI |
| M1 ร้านค้าหลัก | 01 | 🚀 | 104 🚀 + 1 ⏸ | ⏸ CORE-14e |
| M2 การชำระเงิน | 06 | 🚀 | 11 🚀 | PAY-3 แตกเป็น 3a/3b1/3b2 |
| M3 E-voucher | 02 | 🚀 | 27 🚀 | — |
| M4 Flash sale | 03 | 🚀 | 19 🚀 + 2 ✕ | ✕ FS-9, FS-12 |
| M5 Group buying | 04 | 🚀 | 39 🚀 | + ADR-011 #33 |
| M6 Affiliate | 05 | 🚀 | 34 🚀 + 1 ⏸ | ⏸ AF-11 |
| M7 Scale และ hardening | 07 | 🚀 (ส่วนที่ไม่ ⏸) | 32 🚀 + 3 ⏸ | ⏸ OPS-3b, OPS-3c, OPS-19 |
| Admin UI ใช้ component ของ Medusa | 08 | 🚀 | 41 🚀 | ADR-018; ADM-22/36 เป็นผลตรวจไม่มี PR |
| Release v0.3.0 (รอบ 40) | 01–08 | 🚀 | 32 🚀 | รวม CORE-75 #465 |
| รอบ 41 | 01–08 | 🚀 | 36 🚀 + 1 ✕ | ✕ PAY-13 (ปิดโดย hotfix #468) |
| รอบ 42 | 01–08 | 🚀 | 21 🚀 | v0.3.1 (#561); ADR-029 |
| รอบ 44 storefront shadcn/ui | 09 | ☑ | 16 ☑ (#566–#581; เอกสาร #565) | ADR-030 accepted 2026-11-26; stack; งด release ระหว่าง SFUI-2..6 สิ้นสุดแล้ว |
| รอบ 45 เก็บกวาดหลัง SFUI-7 | 09 | ☑ | 7 ☑ (#584–#590; เอกสาร #583) | ฟอนต์ `text-*-regular/semi` + floating label; stack แบบรอบ 44; ไม่งด release |
| รอบ 46 admin ภาษาไทย | 10 | ☑ | 4 ☑ (#594–#597; เอกสาร #593) | ADR-031 accepted 2026-11-26; stack แบบรอบ 44; Q1 = ก; ยังไม่ release |
| รอบ 43 | 01, 03, 04, 06–08 | ◐ | 4 🚀 + 1 ☑ + 14 ☐ | 4 🚀 (3 train #557 + OPS-39 #559) ใน v0.3.1; OPS-40 ☑ #562 ก่อน go-live (ไม่อยู่ใน v0.3.1); 14 ตัวหลัง go-live (รวม OPS-41) |

จำนวน task นับจากตารางใน history.md ณ 2026-11-24 และตารางรอบ 43 ด้านบน ณ 2026-11-25 (task ที่อยู่หลาย milestone นับที่ milestone หลักของ spec)

## Backlog หลัง v1.0 (owner ตัดสินเลื่อน — ไม่มี AC จนกว่าจะกลับมาทำ)

- **CORE-14e** nonce กันฟอร์ม no-JS ส่งซ้ำ (owner Q-F7 2026-10-27 — กรณี qty สองเท่า; กรณี cart ค้าง 2 ใบ planner รวมเข้า) — spec 01 Open questions รอบ 9
- **OPS-3b** rate limiting (owner Q-O1 2026-10-27) — spec 07 AC-22, ข้อเสนอเดิมใน Q-O1
- **OPS-3c** error tracking Sentry (owner Q-O2 2026-10-27) — spec 07 AC-23, ข้อเสนอเดิมใน Q-O2
- **AF-11** reconcile entry ที่ approve แล้วของ order ที่ยกเลิกแต่ไม่มี reversal (owner Q15 2026-10-27) ·
  dedupe `/affiliate/products` ใน SQL เมื่อแคตตาล็อกใหญ่ (planner, review #122) ·
  entry `pending` ยอดสุทธิ 0 ของ order ที่ยกเลิกค้างและถูกสแกนทุกวัน (planner รอบ 11, review #146)
- **OPS-19** staging load test: burst 500 rps × 60s จริง + p95 < 300ms เป็น gate (owner 2026-11-03, ย้ายจาก AC-2 ของ OPS-4) —
  spec 07 AC-30; ต้องมี ADR staging ก่อน (infra ใหม่)
- **FS-9** ใส่ exclusivity rule ให้ automatic promotion ใหม่อัตโนมัติ (owner 2026-10-27: ไม่ทำใน v1 — admin กด Save ใน widget ของ FS-5 เอง) —
  spec 03 AC-15 (ยกเลิก)
- **resolve-product-ids แบ่งหน้า** `query.graph` ของ option กลางที่ผูกหลายสินค้า (planner รอบ 13, review #200) —
  spec 01 รอบ 13 "ไม่ทำ/ยอมรับ"; ทำเมื่อ option เดียวผูกสินค้าหลักร้อยจริง

## หาหัวข้อเดิม (spec/ADR เก่าอ้างชื่อหัวข้อเหล่านี้ของ ROADMAP)

| หัวข้อเดิมใน ROADMAP | อยู่ที่ |
|---|---|
| บรรทัดสถานะ/ประวัติรายรอบ (รอบ 12–41), "ก่อนเปิดร้านจริง (go-live)" ฉบับเดิม | [`history.md`](roadmap/history.md) หัวข้อ "บันทึกสถานะและประวัติรายรอบ" |
| M0–M7, Admin UI, Release v0.3.0, รอบ 41, รอบ 42 (ฉบับเสนอ) | [`history.md`](roadmap/history.md) ชื่อหัวข้อเดิม |
| "รอบ 42 → release v0.3.1 (รอบปัจจุบัน)" (ตาราง 21 task, merge train, คำตัดสิน) | [`history.md`](roadmap/history.md) หัวข้อ "รอบ 42 — ผลจริง" |
| "Backlog follow-up" / "หัวข้อ Backlog" | [`followups-archive.md`](roadmap/followups-archive.md) |
| "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31–39)" | [`followups-archive.md`](roadmap/followups-archive.md) ชื่อหัวข้อเดิม |

## ข้อตกลงการทำงานต่อ PR

planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)

แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้ ·
กติกา merge/CI/dependency ดู `CLAUDE.md` หัวข้อ "Branching และ PR"
