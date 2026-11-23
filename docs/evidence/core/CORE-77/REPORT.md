# QA CORE-77 (PR #487) — ป้ายตะกร้าไม่ค้าง aria-busy เมื่ออ่าน cart ล้ม
Spec: docs/spec/01-core-medusa.md กฎข้อ 135 / AC-176 — ทดสอบบน prod build commit 69ddab10 ที่ 1280×720 และ 375×812

| AC | Result | Evidence |
|----|--------|----------|
| AC-176 ข้อ 1: mock retrieveCart 500 บน /th → ภายใน 5 วิ "ตะกร้า" ไม่มี aria-busy, href /th/cart, กดแล้วไป /th/cart | pass (1280: 779ms, 375: 654ms) | qa487-ac176-1280-failed-label.png, qa487-ac176-375-failed-label.png |
| AC-176 ข้อ 2: เลิก mock แล้วไปหน้าบัญชี → "ตะกร้า (2)" อ่าน cart ≤ 2 ครั้ง | pass (อ่าน 1 ครั้งทั้งสองขนาดจอ) | qa487-ac176-1280-recovered.png, qa487-ac176-375-recovered.png |
| AC-176 ข้อ 3: ระหว่างที่ยังล้มและไม่เปลี่ยนหน้า ไม่มีการอ่าน cart ซ้ำภายใน 10 วิ | pass (reads คงที่ 1 → 1) | ผล test |
| Regression: ระหว่างโหลด "ตะกร้า" + aria-busy="true" ไม่มี "(0)" กระพริบ แล้วเป็น "(2)" | pass (ประวัติป้าย: ["ตะกร้า busy=true", "ตะกร้า (2)"]) | qa487-reg-1280-loading.png |
| Regression: ลูกค้าไม่มี cart → "ตะกร้า (0)" ไม่มี aria-busy | pass (1280 และ 375) | ผล test |

## Negative / edge case
| กรณี | Result |
|------|--------|
| ล้มต่อเนื่องแล้วเปลี่ยนหน้า → อ่านใหม่ 1 ครั้ง ป้ายยังเป็น "ตะกร้า" ไม่มี aria-busy | pass |
| network abort (ไม่ใช่ 500) → ป้ายไม่ค้าง busy | pass |
| อ่านสำเร็จแล้วเปลี่ยนหน้า → ไม่อ่าน cart เพิ่ม (ไม่กระทบ #485) | pass |
| e2e ของ builder (core-77) + core-72 + core-19a | 13/13 pass |

หมายเหตุ: ที่ 375 `nav-account-link` ซ่อนอยู่ จึงไปหน้าบัญชีผ่าน `nav-menu-button` → account-link; รูป reg-1280-loading ต่างจาก failed-label แค่ attribute `aria-busy` (มองไม่เห็นบนจอ) — ยืนยันด้วยประวัติป้ายใน test
Playwright report/trace ฉบับเต็มอยู่ใน CI artifact (14 วัน)
