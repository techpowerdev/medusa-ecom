# QA FS-15 — PR #178 (feat/FS-15-flash-qty-guard @ 3e92fe3)

Spec: `docs/spec/03-flash-sale.md` กฎข้อ 20, AC-21, AC-22 | ตรวจบน prod build (`medusa start` + `next start`), manual payment
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40562021431 (attempt 2 เขียว; artifact `e2e-evidence` มี report/trace เต็ม 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-21 (20a) PDP เลือก 3 ขณะเหลือ 2 → เตือนไทย + `add-product-button` disabled; เลือก 2 → กดได้; `show_remaining=false` → ไม่เตือน | pass | 01-pdp-qty-exceeds-remaining.png (builder), e2e flash-sale-fs15 4/4 |
| AC-21 (20a) 375×812: เตือน + `add-product-button` และ `mobile-cart-button` disabled, ไม่ล้นจอ; ลดเป็น 2 → กดได้ | pass | qa-01-pdp-375-qty-exceeds.png |
| AC-21 (20b) `/th/cart`: เตือนเฉพาะ line flash (line ปกติ qty 3 ไม่เตือน); ใส่โค้ดผ่าน UI (code ชนะ) → หาย; ลบโค้ด → กลับมา; ลดเป็น 2 → หาย | pass | 02-cart-flash-exceeds-remaining.png (builder), QA e2e |
| AC-22 (20c) `FLASH_SOLD_OUT` ตอน complete → ข้อความไทยเฉพาะ code | pass | 03-review-flash-sold-out.png (builder) |
| AC-22 (20c) `FLASH_LIMIT_EXCEEDED` (per_customer_limit=1, qty 2) → ข้อความไทยต่างจาก SOLD_OUT ไม่มีอังกฤษ; dblclick → ไม่มี order | pass | qa-02-review-flash-limit-exceeded.png |
| AC-22 (20c) `PROMOTION_NOT_COMBINABLE` (ตั้ง state ตรง DB หลังถึงขั้น review) → ข้อความไทยของ code | pass | QA e2e (ในเครื่อง ไม่ได้ commit) |

## Negative / edge
- สินค้านอกแคมเปญ เลือก 3 → ไม่เตือน กดได้ — pass
- แคมเปญ sold out → `flash-sold-out`, select/ปุ่ม disabled, ไม่มีคำเตือนซ้อน — pass
- แคมเปญหมดอายุ → PDP/cart ไม่เตือน — pass
- กดสั่งซื้อซ้ำสองครั้งตอน 409 → error เดียว ไม่มี order — pass

Regression: flash-sale-fs15 + core-24-pdp-quantity + flash-sale-fs13 = 10/10 pass

## CI attempt 1 ล้มที่ `core-19a-nav-cart-search.spec.ts:183` (S+M ได้ 0) — ไม่เกี่ยวกับ FS-15
- รันซ้ำ `--repeat-each=10 --workers=1`: PR 20/20, develop `d01e431` 20/20; race S→M→add ทันที: PR 30/30, develop 30/30; CPU throttle 6 เท่า: PR 20/20, develop 20/20
- trace ของ CI: add ครั้งที่สองส่ง variant ของ S (ตัวเลือก M ถูกรีเซ็ตกลับ ไม่ใช่ปุ่มถูก disable) — อยู่ในโค้ด PDP ที่ PR นี้ไม่ได้แก้ → แยกเป็น task (defect PDP: สลับไซซ์เร็วแล้วอาจได้ไซซ์เดิม)

## Defect ของ FS-15
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- จอ 375 แถบปุ่มด้านล่างของ mobile ทับปุ่มหลักบางส่วน (พฤติกรรมเดิม)
