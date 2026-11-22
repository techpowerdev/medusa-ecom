# QA PAY-14 (PR #482) — spec 06 กฎข้อ 16 / AC-27

| AC | Result | Evidence |
|----|--------|----------|
| AC-27 (a) PI จบแล้ว → สร้าง session ใหม่อัตโนมัติ 1 ครั้ง แล้ว Elements mount กับ PI ใหม่ | pass (ยืนยันจาก CI) | CI run 44952377187 job storefront-e2e: `pay-14-stale-session.spec.ts:90` (Stripe test mode จริง ไม่ถูก skip) |
| AC-27 (a) สร้างอัตโนมัติล้ม (mock 500) → notice ไทย → คลิก radio เดิมแล้วได้ session ใหม่ | pass (CI + qa) | CI `pay-14-stale-session.spec.ts:139`; qa C1 — qa482-01-reset-notice-after-500.png |
| AC-27 (b) ไม่มี "terminal state" และไม่มีข้อความอังกฤษของ Stripe | pass (CI + qa) | qa C1–C4 — qa482-02-auto-renew-once-notice.png |
| AC-27 (c) ไม่ confirm กับ PI เดิม จ่ายด้วย session ใหม่ได้ order captured | pass (ยืนยันจาก CI) | CI `pay-14-stale-session.spec.ts:90` |
| AC-27 (c1)/(c2)/(d) | pass (ยืนยันจาก CI) | unit storefront + integration `payment-collection-reset.spec.ts` › PAY-14 d |
| Edge: auto renew ไม่วน | pass | C2: หลัง loaderror มี action 1 ครั้ง รอ 8 วินาทีไม่มีเพิ่ม |
| Edge: กด retry ซ้ำ | pass | C3: คลิก 6 ครั้งได้ 6 action; C3b: dblclick จริงได้ 1 action |
| Edge: 375px | pass | qa482-03-375-reset-notice.png |
| Regression: manual payment | pass | qa482-04-manual-order-confirmed.png |
| Regression: `/account/orders/:id/pay` (group buy) | pass | qa482-05-gb-order-pay-form.png |

วิธีทดสอบในเครื่อง: ไม่มี Stripe key จริง ใช้ key ปลอม แล้วแก้ session pp_system_default ใน DB ของ qa ให้ชี้ PI ปลอม → Elements loaderror จริงและเข้าเส้นทาง onStaleSession; การสร้าง session ใหม่ให้สำเร็จยืนยันจาก CI (storefront-e2e 442 passed, artifact ของ run 44952377187)

ข้อสังเกต: notice `payment-session-reset-notice` ค้างเมื่อเปลี่ยนไปเลือก manual/พร้อมเพย์ (follow-up)
