# SFUI-10 — QA evidence (spec 09 กฎ 24)

ทดสอบรวมทั้ง stack รอบ 45 ที่ปลาย `c43e5764` (SFUI-10 ซึ่งรวม 8 + 9a..9e) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่, Stripe test mode + `stripe listen`
e2e chromium `--workers=1` ทั้งชุด = 534 ผ่าน / 5 ล้ม / 1 ข้าม — ล้มทั้งหมดไม่ใช่ของรอบ 45: `core-50-nav-narrow` 1280 (ความกว้างต่าง 1.27px บน macOS, ทราบอยู่แล้ว)
และ 4 ตัวที่ค้าง `step=payment` หลังกดปุ่มไปขั้น review ด้วยบัตร (flake เดิม; รันซ้ำเดี่ยวผ่านทั้งหมด และ `payments` AC-3 ล้มสลับผ่านบน commit ฐาน `e2a3ffa9` ด้วย);
ข้าม 1 = `pay-19` (ไม่ตั้ง `E2E_PROMPTPAY_REFUND_EMAIL`) · `test:e2e:unit` 212/212 · vitest 132 ไฟล์ 2022/2022
เทียบกับ commit ฐาน `e2a3ffa9` (build แยกที่ :8191 บน backend/DB เดียวกัน): อ่าน `fontSize/lineHeight/fontWeight` ของทุก element ที่มีข้อความใน 21 หน้า × 390/1280
และ screenshot ทั้งหน้า — ตรงกันทุกหน้า (screenshot เหมือนกันระดับ byte) ยกเว้นป้ายตัวเลือก/จำนวนบน PDP และ `/g/<token>` ที่ SFUI-8 ตั้งใจแก้
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

ไม่มี UI ใหม่ — ไม่มี screenshot (ภาพเทียบอยู่ใน SFUI-8 และ SFUI-9a..9e)

| AC | Result | Evidence |
|----|--------|----------|
| AC-24 | pass | (a) regex ของ AC-20 บน `apps/storefront/src/**` = 0; (b) `globals.css` ไม่มี `@utility text-`; (c) `src/lib/utils.ts` = `export { cn } from "cn"` และไม่มีไฟล์ใน `src/` อ้าง `cn/config`/`createCn`/`FONT_SIZE_UTILITIES`; `sfui-10-font-utilities.unit.spec.ts` อยู่ใน `test:e2e:unit` 212/212; vitest 2022/2022; `pnpm --filter storefront build` ผ่าน; CSS ที่ build แล้วไม่มี `text-small-regular` (commit ฐานมี); e2e ทั้งชุด 534/540 (ล้ม 5 = เครื่อง/flake เดิม ดูด้านบน) |
| AC-25 | pass | `git diff b2b27ccc c43e5764 --stat -- apps/backend apps/storefront/src/components/ui apps/storefront/package.json pnpm-lock.yaml` ว่าง |
