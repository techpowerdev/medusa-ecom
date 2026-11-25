import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import FlashCodeNotice from "../components/flash-code-notice"
import CartErrorNotice from "../components/cart-error-notice"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
  flashExceeded,
  flashCustomerLimit,
  errorNotice,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  /** FS-15 (กฎข้อ 20b): line id → remaining_units ของ line ที่จำนวนเกินโควตา flash */
  flashExceeded?: Record<string, number>
  /** FS-21 (กฎข้อ 26b): line id → สิทธิ์ flash ที่เหลือของลูกค้า เมื่อจำนวนรวมในแคมเปญเกิน */
  flashCustomerLimit?: Record<string, number>
  /** PAY-12 (spec 06 กฎข้อ 14): ข้อความไทยจาก `cartErrorNotice` — null = ไม่แสดง */
  errorNotice?: string | null
}) => {
  return (
    <div className="py-12">
      <div className="content-container" data-testid="cart-container">
        {errorNotice && (
          <CartErrorNotice
            message={errorNotice}
            itemsKey={(cart?.items ?? []).map((item) => `${item.id}:${item.quantity}`).sort().join(",")}
          />
        )}
        {/* CORE-44 (กฎข้อ 102a): คอลัมน์ซ้ายหดได้ (minmax(0,1fr)) และช่วง small–ก่อน large ระยะห่างเล็กลง — คอลัมน์สรุปไม่ล้นที่ 1024 เมื่อมีส่วนลด */}
        {cart?.items?.length ? (
          <div className="grid grid-cols-1 small:grid-cols-[minmax(0,1fr)_360px] gap-x-10 large:gap-x-40">
            <div className="flex flex-col bg-white py-6 gap-y-6">
              {!customer && (
                <>
                  <SignInPrompt />
                  <Divider />
                </>
              )}
              <ItemsTemplate
                cart={cart}
                flashExceeded={flashExceeded}
                flashCustomerLimit={flashCustomerLimit}
              />
            </div>
            <div className="relative" data-testid="cart-summary-column">
              <div className="flex flex-col gap-y-8 sticky top-12">
                {cart && cart.region && (
                  <>
                    <FlashCodeNotice cart={cart} />
                    <div className="bg-white py-6">
                      <Summary cart={cart} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <EmptyCartMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
