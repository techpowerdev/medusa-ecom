import type { CreateAccountHolderInput } from "@medusajs/framework/types"
// ADR-035: class ของ provider อยู่ใน dist/services (index ของ package export เฉพาะ ModuleProvider) — framework ไม่มี entry point ของ class นี้
// eslint-disable-next-line @medusajs/import-from-framework-not-internal
import { StripePromptpayService, StripeProviderService } from "@medusajs/payment-stripe/dist/services"
import { createSharedAccountHolder } from "./shared-customer"

// PAY-26 (spec 01 กฎข้อ 157): override เฉพาะ createAccountHolder — identifier/method อื่นสืบทอดจากของ Medusa
export class SharedStripeProviderService extends StripeProviderService {
  async createAccountHolder(input: CreateAccountHolderInput) {
    return createSharedAccountHolder(input, StripeProviderService.identifier, (i) => super.createAccountHolder(i))
  }
}

export class SharedStripePromptpayService extends StripePromptpayService {
  async createAccountHolder(input: CreateAccountHolderInput) {
    return createSharedAccountHolder(input, StripePromptpayService.identifier, (i) => super.createAccountHolder(i))
  }
}
