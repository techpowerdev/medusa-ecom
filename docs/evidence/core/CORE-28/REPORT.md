# QA — CORE-28: `promotion-error` แสดงแม้ช่องใส่โค้ดส่วนลดปิด (PR #241)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 85, AC-121
- Branch: `fix/CORE-28-promotion-error-visible` @ `28d6168`
- สภาพแวดล้อม: prod build (`medusa start` จาก `.medusa/server` และ `next build && next start`), Node 22, Stripe test mode
- วิธีตรวจ: Playwright (chromium) หา element ด้วย `data-testid` เทียบข้อความกับ constant `SIGN_IN_AGAIN_MESSAGE` และตรวจความเป็นไทยด้วย regex `[฀-๿]` ไม่ mock request ใดๆ
- report/trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #241 (เก็บ 14 วัน)

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-121 unit (`src/core-28-promotion-error.test.ts`) | pass | vitest 3/3 ผ่าน; ใช้ component ของ develop แล้วล้ม 2 test ที่เป็น UI ตามที่ระบุ |
| AC-121 e2e 1280px: ช่องปิด ลบ `_medusa_jwt` แล้วกดลบโค้ด → `promotion-error` = `SIGN_IN_AGAIN_MESSAGE` (ไทย) โดย `discount-input` ไม่แสดง, โค้ดและแถวสินค้ายังอยู่, cart ใน backend ไม่เปลี่ยน | pass | qa-01-ac121-closed-remove-sign-in-again.png |
| AC-121 e2e 375px (ขั้นตอนเดียวกัน, ข้อความไม่ล้นจอแนวนอน) | pass | qa-04-ac121-375-closed-remove.png |
| AC-121: ใส่โค้ดที่ใช้ไม่ได้แล้วปิดช่อง → ข้อความยังอยู่ (ไทย) | pass | qa-02-ac121-invalid-code-closed.png |
| AC-121: ลบโค้ดสำเร็จตอนช่องปิด → `promotion-error` ว่าง, backend ไม่มีโค้ด | pass | qa-03-ac121-remove-success-clears.png |
| AC-121 grep: `e2e/core-19c-delete-button-error.spec.ts` ไม่มีวลี "ก่อนถึง action" | pass | grep นับได้ 0 |

regression บน prod build ผ่าน 11/11: `core-14g-action-stale-jwt` (AC-120), `core-19c-delete-button-error` (AC-100/AC-104 ทั้ง 1280 และ 375px), `core-4g-checkout-polish` (AC-99 โค้ดหมดอายุ), `flash-sale-storefront` (ใส่โค้ดร่วมกับ flash sale) และ `core-4g-e2e-hygiene.unit` ผ่าน 2/2 เมื่อรัน QA spec กับ core-14g ซ้ำด้วย `--repeat-each=3` ผ่าน 24/24

## Negative / edge case
| กรณี | ผล |
|------|----|
| ใส่โค้ดของ campaign ที่หมดอายุแล้วปิดช่อง | ข้อความไทยยังอยู่ ไม่มีโค้ดเพิ่ม — pass |
| ลบ JWT แล้วดับเบิลคลิกลบโค้ดตอนช่องปิด | มี `promotion-error` แค่ 1 ตัว (`SIGN_IN_AGAIN_MESSAGE`) โค้ดยังอยู่ทั้งในหน้าและ backend — pass |
| เปิด/ปิดช่องซ้ำขณะมี error | `promotion-error` มี 1 element ข้อความเดิม — pass |
| ใส่โค้ดผิดแล้วตามด้วยโค้ดถูก | error หาย, มีแถวโค้ด — pass |
| หน้า checkout (`checkout-summary`) ช่องปิด ลบ JWT แล้วลบโค้ด | `SIGN_IN_AGAIN_MESSAGE` แสดงโดยไม่ต้องเปิดช่อง — pass (qa-05-edge-checkout-closed-remove.png) |

## Defect
ไม่พบ

## Observation
- **O-1** comment ใน `e2e/core-14g-action-stale-jwt.spec.ts:125` ("promotion-error แสดงเฉพาะเมื่อเปิดช่องใส่โค้ด") ไม่ตรงกับพฤติกรรมหลัง PR นี้ test ยังผ่านเพราะเปิดช่องก่อน — เปิดเป็น task CORE-28b (กฎข้อ 90, AC-126) ใน PR #245
- **O-2** โค้ดที่ไม่มีอยู่จริงได้ข้อความ `PROMOTION_FAILED` ("ใช้โค้ดส่วนลดนี้ไม่ได้ กรุณาตรวจสอบโค้ดอีกครั้ง") ส่วนโค้ดหมดอายุได้ `PROMOTION_NOT_APPLICABLE` ซึ่งเป็นพฤติกรรมเดิมของ CORE-4i ไม่ใช่ผลของ PR นี้
- **O-3** `removePromotionCode` ไม่ล้าง error เดิมก่อนส่ง request (`addPromotionCode` ล้าง) ข้อความเก่าจึงค้างอยู่ระหว่างรอ action ไม่กระทบ AC-121 เพราะผลสุดท้ายถูกต้อง

## สรุป
AC-121 ผ่านครบทั้ง unit และ e2e จากมุมผู้ใช้บน prod build ทั้ง 1280px และ 375px รวมทั้งหน้า cart และหน้า checkout ข้อความเป็นภาษาไทย regression ของ AC-120, AC-104, AC-100 และ AC-99 ไม่เสีย ไม่พบ defect
