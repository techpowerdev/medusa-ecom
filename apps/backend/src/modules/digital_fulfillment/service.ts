import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CreateFulfillmentResult,
  FulfillmentOption,
} from "@medusajs/framework/types"

export const DIGITAL_DELIVERY_OPTION_ID = "digital-delivery"

/**
 * EV-3 (spec 02, ADR-006): fulfillment provider `digital` สำหรับสินค้า e-voucher
 * ส่งมอบทันที ไม่มีพัสดุ/label — code + อีเมลจัดการใน allocate & deliver workflow (EV-4)
 * ลงทะเบียนใน medusa-config.ts ด้วย id `digital` → provider id `digital_digital`
 */
class DigitalFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "digital"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: DIGITAL_DELIVERY_OPTION_ID }]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data
  }

  // ราคา flat (฿0) ตั้งที่ shipping option ใน seed
  async canCalculate(): Promise<boolean> {
    return false
  }

  async calculatePrice(): Promise<CalculatedShippingOptionPrice> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Digital fulfillment does not support calculated prices"
    )
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: { channel: "email" }, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  // business rule 6: เรียกคืน code ที่ส่งมอบแล้วไม่ได้
  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Delivered e-voucher codes cannot be returned"
    )
  }
}

export default DigitalFulfillmentProviderService
