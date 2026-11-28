"use client"
import { setAddresses } from "@lib/data/cart"
import useToggleState from "@lib/hooks/use-toggle-state"
import { addressLines } from "@lib/util/address-lines"
import compareAddresses from "@lib/util/compare-addresses"
import { isDigitalOnlyCart } from "@lib/util/digital-checkout"
import { HttpTypes } from "@medusajs/types"
import Divider from "@modules/common/components/divider"
import Input from "@modules/common/components/input"
import Spinner from "@modules/common/icons/spinner"
import { CircleCheck } from "lucide-react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, type FormEvent } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"
import { Button } from "@/components/ui/button"

const Addresses = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { countryCode } = useParams()
  // EV-7c (spec 02 กฎข้อ 24b): cart digital-only เก็บเฉพาะที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษี (ไม่มีคำว่าจัดส่ง)
  const digitalOnly = isDigitalOnlyCart(cart)

  const isOpen = searchParams.get("step") === "address"

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  )

  const handleEdit = () => {
    router.push(pathname + "?step=address")
  }

  const [message, formAction] = useActionState(setAddresses, null)

  // CORE-52 (กฎข้อ 110d, qa #353 D-1): React 19 reset `<form action>` หลัง action คืนผล — reset ของ browser คืน
  // defaultChecked/defaultSelected/defaultValue ทำให้ checkbox "ใช้ที่อยู่จัดส่ง..." กลับเป็นติ๊กขณะฟอร์มใบเสร็จยังแสดง
  // (ส่งใหม่ได้ same_as_billing=on) — ทุกช่องของฟอร์มนี้คุมด้วย state ของ React จึงยกเลิก reset ทั้งฟอร์ม
  const keepFormValues = (event: FormEvent<HTMLFormElement>) => event.preventDefault()

  return (
    <div className="bg-white" data-testid="addresses-section">
      <div className="flex flex-row items-center justify-between mb-6">
        <h2
          className="text-2xl font-semibold flex flex-row gap-x-2 items-baseline"
          data-testid="addresses-heading"
        >
          {digitalOnly ? "ที่อยู่สำหรับออกใบเสร็จ/ใบกำกับภาษี" : "ที่อยู่จัดส่ง"}
          {!isOpen && <CircleCheck className="size-4" />}
        </h2>
        {!isOpen && cart?.shipping_address && (
          <p className="text-sm leading-[1.4rem]">
            <Button variant="link" onClick={handleEdit} data-testid="edit-address-button">
              แก้ไข
            </Button>
          </p>
        )}
      </div>
      {isOpen && digitalOnly ? (
        <form action={formAction} onReset={keepFormValues}>
          <div className="pb-8">
            <input type="hidden" name="checkout_country_code" value={countryCode as string} />
            <BillingAddress cart={cart} />
            {/* SFUI-12b (spec 09 กฎ 37b): อีเมลไม่มีคู่ — < 768px เต็มแถว, ≥ md ครึ่งแถวตามเดิม */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="อีเมล"
                name="email"
                type="email"
                title="กรุณากรอกอีเมลให้ถูกต้อง"
                autoComplete="email"
                defaultValue={cart?.email || customer?.email || ""}
                required
                data-testid="billing-email-input"
              />
            </div>
            <SubmitButton className="mt-6" data-testid="submit-address-button">
              ไปขั้นตอนการชำระเงิน
            </SubmitButton>
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : isOpen ? (
        <form action={formAction} onReset={keepFormValues}>
          <div className="pb-8">
            <input type="hidden" name="checkout_country_code" value={countryCode as string} />
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
            />

            {!sameAsBilling && (
              <div>
                <h2 className="text-2xl font-semibold gap-x-4 pb-6 pt-8">
                  ที่อยู่สำหรับออกใบเสร็จ
                </h2>

                <BillingAddress cart={cart} />
              </div>
            )}
            <SubmitButton className="mt-6" data-testid="submit-address-button">
              ไปขั้นตอนการจัดส่ง
            </SubmitButton>
            <ErrorMessage error={message} data-testid="address-error-message" />
          </div>
        </form>
      ) : (
        <div>
          {/* CORE-38 (กฎข้อ 96): overflow-wrap สืบทอดถึงทุกข้อความในกล่องสรุป (ชื่อ/ที่อยู่/เมือง/อีเมลยาวไม่มีช่องว่าง)
              ตัดบรรทัดในคอลัมน์ของตัวเอง; คอลัมน์ต้องมี min-w-0 */}
          <div className="text-xs leading-5 font-normal [overflow-wrap:anywhere]">
            {cart && cart.billing_address && digitalOnly ? (
              // CORE-38: < 640px เรียงแนวตั้ง, ≥ sm แถวเดียว
              <div className="flex flex-col gap-y-4 w-full sm:flex-row sm:items-start sm:gap-x-1">
                <div className="flex flex-col min-w-0 sm:w-1/2" data-testid="billing-address-summary">
                  <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                    ที่อยู่สำหรับออกใบเสร็จ/ใบกำกับภาษี
                  </p>
                  <p className="text-sm leading-[1.4rem] text-muted-foreground">
                    {cart.billing_address.first_name} {cart.billing_address.last_name}
                  </p>
                  {/* SFUI-18a (spec 09 กฎ 57): ที่อยู่ตามลำดับไทย; SFUI-20c (กฎ 71): ไม่มีบรรทัดประเทศ */}
                  {addressLines(cart.billing_address).map((line, i) => (
                    <p key={i} className="text-sm leading-[1.4rem] text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="flex flex-col min-w-0 sm:w-1/2" data-testid="billing-contact-summary">
                  <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">ข้อมูลติดต่อ</p>
                  <p className="text-sm leading-[1.4rem] text-muted-foreground">
                    {cart.billing_address.phone}
                  </p>
                  <p className="text-sm leading-[1.4rem] text-muted-foreground">{cart.email}</p>
                </div>
              </div>
            ) : cart && cart.shipping_address ? (
              <div className="flex items-start gap-x-8">
                {/* CORE-38: < 640px เรียงแนวตั้ง, ≥ sm แถวเดียว */}
                <div className="flex flex-col gap-y-4 w-full sm:flex-row sm:items-start sm:gap-x-1">
                  <div
                    className="flex flex-col min-w-0 sm:w-1/3"
                    data-testid="shipping-address-summary"
                  >
                    <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                      ที่อยู่จัดส่ง
                    </p>
                    <p className="text-sm leading-[1.4rem] text-muted-foreground">
                      {cart.shipping_address.first_name}{" "}
                      {cart.shipping_address.last_name}
                    </p>
                    {addressLines(cart.shipping_address).map((line, i) => (
                      <p key={i} className="text-sm leading-[1.4rem] text-muted-foreground">
                        {line}
                      </p>
                    ))}
                  </div>

                  <div
                    className="flex flex-col min-w-0 sm:w-1/3"
                    data-testid="shipping-contact-summary"
                  >
                    <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                      ข้อมูลติดต่อ
                    </p>
                    <p className="text-sm leading-[1.4rem] text-muted-foreground">
                      {cart.shipping_address.phone}
                    </p>
                    <p
                      className="text-sm leading-[1.4rem] text-muted-foreground"
                      data-testid="shipping-contact-email"
                    >
                      {cart.email}
                    </p>
                  </div>

                  <div
                    className="flex flex-col min-w-0 sm:w-1/3"
                    data-testid="billing-address-summary"
                  >
                    <p className="text-sm leading-[1.4rem] font-medium text-foreground mb-1">
                      ที่อยู่สำหรับออกใบเสร็จ
                    </p>

                    {sameAsBilling ? (
                      <p className="text-sm leading-[1.4rem] text-muted-foreground">
                        ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง
                      </p>
                    ) : (
                      <>
                        <p className="text-sm leading-[1.4rem] text-muted-foreground">
                          {cart.billing_address?.first_name}{" "}
                          {cart.billing_address?.last_name}
                        </p>
                        {addressLines(cart.billing_address).map((line, i) => (
                          <p key={i} className="text-sm leading-[1.4rem] text-muted-foreground">
                            {line}
                          </p>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Spinner />
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Addresses
