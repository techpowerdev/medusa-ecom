import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import {
  checkoutStep,
  deliveryStepDone,
  isDigitalOnlyCart,
  safeCountryCode,
} from "@lib/util/digital-checkout"
import { shippingOptionsForCart } from "@lib/util/shipping-options"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import { redirect } from "next/navigation"

export default async function CheckoutForm({
  cart,
  customer,
  countryCode,
  step,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  countryCode: string
  step?: string
}) {
  if (!cart) {
    return null
  }

  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  // CORE-35 (spec 01 กฎข้อ 93): "เสร็จ" ใช้ option ที่เลือกในรายการที่กรองแล้ว (กฎข้อ 89) — คำนวณที่นี่ครั้งเดียวแล้วส่งเป็น prop
  // method ค้างที่ถูกกรองออก (เช่น Digital delivery บน cart ที่ต้องจัดส่ง) ไม่นับ
  const options = shippingOptionsForCart(shippingMethods, cart)
  const deliveryDone = deliveryStepDone(cart, options)
  // CORE-41 (กฎข้อ 99): เปิด step=payment/review ตรงๆ ขณะขั้นก่อนหน้ายังไม่เสร็จ → ขั้นแรกที่ยังไม่เสร็จ (address หรือ delivery)
  // ปลายทาง (address/delivery) ไม่เข้าเงื่อนไขนี้ จึงไม่ redirect วน
  if (step === "payment" || step === "review") {
    const firstIncomplete = checkoutStep(cart, options)
    if (firstIncomplete !== "payment") {
      const cc = safeCountryCode(countryCode)
      redirect(`${cc ? `/${cc}` : ""}/checkout?step=${firstIncomplete}`)
    }
  }

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      <Addresses cart={cart} customer={customer} />

      {/* EV-7c (spec 02 กฎข้อ 24a): cart digital-only ไม่มีขั้น delivery;
          CORE-33: Shipping กรองตามกฎข้อ 89 เอง (shippingOptionsForCart) เพื่อใช้รายการเดียวกันกับ method ที่เลือก */}
      {!isDigitalOnlyCart(cart) && (
        <Shipping cart={cart} availableShippingMethods={shippingMethods} />
      )}

      <Payment
        cart={cart}
        availablePaymentMethods={paymentMethods}
        deliveryDone={deliveryDone}
      />

      <Review cart={cart} deliveryDone={deliveryDone} />
    </div>
  )
}
