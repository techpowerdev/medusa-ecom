# QA CORE-69 (PR #449) — spec 01 หัวข้อ "Follow-up รอบ 40" กฎข้อ 127 / AC-168
prod build (backend medusa start, storefront next start) @ 89dcf31b, manual payment (ไม่มี Stripe key)

| AC | Result | Evidence |
|----|--------|----------|
| AC-168 ไม่มี payment collection: ?step=review → step=payment ภายใน 5 วินาที เห็น payment-option-* + submit-payment-button ไม่มี submit-order-button | pass | qa449-01-review-without-session-redirected-to-payment.png; e2e core-69 3/3 passed |
| AC-168 มี collection แต่ไม่มี session → step=payment | pass | e2e core-69 (test ที่ 2) |
| AC-168 regression: มี session manual → อยู่ review, submit-order-button enabled, สั่งซื้อสำเร็จ (order 1 ใบแม้ดับเบิลคลิก) | pass | e2e core-69 (test ที่ 3) + QA-3 |

## checklist เพิ่มเติม (สคริปต์ของ qa ไม่ได้ commit)
| ID | กรณี | ผล | หลักฐาน |
|----|------|----|---------|
| QA-1 | เวลา redirect 3 รอบ: 4169 ms (cold start), 1209 ms, 403 ms (ทุกรอบ < 5 วินาที) | pass | log |
| QA-2 | เดินปกติ: เลือก manual → Continue to review → ยังอยู่ review หลังรอ 4 วินาที, reload แล้วยังอยู่ → สั่งซื้อสำเร็จ | pass | qa449-02-review-after-continue.png |
| QA-3 | มี session → ดับเบิลคลิก submit-order-button → order 1 ใบ | pass | log |
| QA-4 | back/forward + เปิด review ซ้อนสองครั้ง (3 รอบ): ไม่วนลูป | pass | log |
| QA-5 | ดับเบิลคลิก Continue to review → review, มี session เดียว | pass | log |
| QA-6 | มือถือ 375px: review → payment, ปุ่มอยู่ในจอ, ไม่มี horizontal scroll | pass | qa449-03-mobile-375-payment.png |
| QA-7 | มี session แล้วเปลี่ยนจำนวนสินค้า (Medusa ล้าง session) → ?step=review ไป payment | pass | log |
| QA-8 | ไม่มีที่อยู่ → address; มีที่อยู่แต่ไม่มีวิธีส่ง → delivery (พฤติกรรมเดิม) | pass | log |
| QA-9 | e-voucher: ไม่มี session → payment; มี session → review → สั่งซื้อสำเร็จ | pass | qa449-04-digital-review-to-payment.png |

## regression
core-19b, core-41, core-52, ev-7c, fs-21 (AC-28 c), thai-ui-checkout → 27 passed, 1 skipped (PromptPay ต้องใช้ Stripe key)
report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #449 (14 วัน)
