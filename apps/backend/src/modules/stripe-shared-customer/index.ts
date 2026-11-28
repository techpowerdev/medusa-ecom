import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { SharedStripePromptpayService, SharedStripeProviderService } from "./service"

// PAY-26 (ADR-035): แทน @medusajs/medusa/payment-stripe — ลงทะเบียนเฉพาะบัตร + พร้อมเพย์ (2 provider ที่ region ใช้)
export default ModuleProvider(Modules.PAYMENT, {
  services: [SharedStripeProviderService, SharedStripePromptpayService],
})
