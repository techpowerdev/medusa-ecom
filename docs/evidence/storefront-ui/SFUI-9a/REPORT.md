# SFUI-9a — QA evidence (spec 09 กฎ 22)

ทดสอบรวมทั้ง stack รอบ 45 ที่ปลาย `c43e5764` (SFUI-10 ซึ่งรวม 8 + 9a..9e) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่, Stripe test mode + `stripe listen`
e2e chromium `--workers=1` ทั้งชุด = 534 ผ่าน / 5 ล้ม / 1 ข้าม — ล้มทั้งหมดไม่ใช่ของรอบ 45: `core-50-nav-narrow` 1280 (ความกว้างต่าง 1.27px บน macOS, ทราบอยู่แล้ว)
และ 4 ตัวที่ค้าง `step=payment` หลังกดปุ่มไปขั้น review ด้วยบัตร (flake เดิม; รันซ้ำเดี่ยวผ่านทั้งหมด และ `payments` AC-3 ล้มสลับผ่านบน commit ฐาน `e2a3ffa9` ด้วย);
ข้าม 1 = `pay-19` (ไม่ตั้ง `E2E_PROMPTPAY_REFUND_EMAIL`) · `test:e2e:unit` 212/212 · vitest 132 ไฟล์ 2022/2022
เทียบกับ commit ฐาน `e2a3ffa9` (build แยกที่ :8191 บน backend/DB เดียวกัน): อ่าน `fontSize/lineHeight/fontWeight` ของทุก element ที่มีข้อความใน 21 หน้า × 390/1280
และ screenshot ทั้งหน้า — ตรงกันทุกหน้า (screenshot เหมือนกันระดับ byte) ยกเว้นป้ายตัวเลือก/จำนวนบน PDP และ `/g/<token>` ที่ SFUI-8 ตั้งใจแก้
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-20 | pass | `grep -rnoE "\btext-(xsmall\|small\|base\|large\|xl\|2xl\|3xl)-(regular\|semi)\b" apps/storefront/src` = 0 บรรทัด (ทั้ง `src/` ที่ปลาย stack) |
| AC-21 | pass | `sfui-9a-font.spec.ts` 3/3 ผ่านทั้งบน commit ฐานและหลังแก้; หน้าแรก, 404 ที่ 390/1280 font ทุก element เท่าฐาน; `sfui-5a-common`, `sfui-mobile-390`, `sfui-6-parity` ผ่าน; 01-home-before-1280.png, 02-home-after-1280.png, 03-not-found-after-390.png |
| AC-25 | pass | `git diff b2b27ccc c43e5764 --stat -- apps/backend apps/storefront/src/components/ui apps/storefront/package.json pnpm-lock.yaml` ว่าง |

ภาพก่อน/หลัง (commit ฐาน `e2a3ffa9` vs `c43e5764`) เหมือนกันระดับ byte: 01/02 (หน้าแรก 1280) และหน้า 404 ที่ 390
