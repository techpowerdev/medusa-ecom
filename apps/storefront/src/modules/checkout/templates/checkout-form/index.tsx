import { retrieveCart } from "@lib/data/cart"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import {
  checkoutRedirectWithLatest,
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
  // CORE-41/CORE-45 (กฎข้อ 99, 103): step ที่ใช้ไม่ได้ (ไม่มี/ไม่รู้จัก, delivery ก่อนมีที่อยู่หรือของ digital-only,
  // payment/review ก่อนขั้นก่อนหน้าเสร็จ) → ขั้นแรกที่ยังไม่เสร็จ; ปลายทางไม่เข้าเงื่อนไขซ้ำ จึงไม่ redirect วน
  // D-1 (qa PR #288): `cart` มาจาก force-cache ซึ่งอาจยังเป็นค่าก่อน mutation (หน้า step=delivery หลัง setAddresses)
  // → ก่อน redirect ตัดสินซ้ำด้วย cart ล่าสุด (no-store) แล้ว render ด้วย cart นั้น; ไม่ redirect = ไม่อ่าน cart เพิ่ม
  const { redirectStep, cart: current, options } = await checkoutRedirectWithLatest(
    step,
    cart,
    (c) => shippingOptionsForCart(shippingMethods, c),
    () => retrieveCart(cart.id, undefined, { fresh: true })
  )
  if (redirectStep) {
    const cc = safeCountryCode(countryCode)
    redirect(`${cc ? `/${cc}` : ""}/checkout?step=${redirectStep}`)
  }
  const deliveryDone = deliveryStepDone(current, options)

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      <Addresses cart={current} customer={customer} />

      {/* EV-7c (spec 02 กฎข้อ 24a): cart digital-only ไม่มีขั้น delivery;
          CORE-33: Shipping กรองตามกฎข้อ 89 เอง (shippingOptionsForCart) เพื่อใช้รายการเดียวกันกับ method ที่เลือก */}
      {!isDigitalOnlyCart(current) && (
        <Shipping cart={current} availableShippingMethods={shippingMethods} />
      )}

      <Payment
        cart={current}
        availablePaymentMethods={paymentMethods}
        deliveryDone={deliveryDone}
      />

      <Review cart={current} deliveryDone={deliveryDone} />
    </div>
  )
}
