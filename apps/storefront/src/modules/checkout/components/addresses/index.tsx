"use client"
import { setAddresses } from "@lib/data/cart"
import useToggleState from "@lib/hooks/use-toggle-state"
import compareAddresses from "@lib/util/compare-addresses"
import { isDigitalOnlyCart } from "@lib/util/digital-checkout"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Divider from "@modules/common/components/divider"
import Input from "@modules/common/components/input"
import { Heading, Text } from "@modules/common/components/ui"
import Spinner from "@modules/common/icons/spinner"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState } from "react"
import BillingAddress from "../billing_address"
import ErrorMessage from "../error-message"
import ShippingAddress from "../shipping-address"
import { SubmitButton } from "../submit-button"

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

  return (
    <div className="bg-white" data-testid="addresses-section">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
          data-testid="addresses-heading"
        >
          {digitalOnly ? "ที่อยู่สำหรับออกใบเสร็จ/ใบกำกับภาษี" : "ที่อยู่จัดส่ง"}
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart?.shipping_address && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-address-button"
            >
              แก้ไข
            </button>
          </Text>
        )}
      </div>
      {isOpen && digitalOnly ? (
        <form action={formAction}>
          <div className="pb-8">
            <input type="hidden" name="digital_only" value="1" />
            <input type="hidden" name="checkout_country_code" value={countryCode as string} />
            <BillingAddress cart={cart} />
            <div className="grid grid-cols-2 gap-4 mt-4">
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
        <form action={formAction}>
          <div className="pb-8">
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
            />

            {!sameAsBilling && (
              <div>
                <Heading
                  level="h2"
                  className="text-3xl-regular gap-x-4 pb-6 pt-8"
                >
                  ที่อยู่สำหรับออกใบเสร็จ
                </Heading>

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
          <div className="text-small-regular">
            {cart && cart.billing_address && digitalOnly ? (
              <div className="flex items-start gap-x-1 w-full">
                <div className="flex flex-col w-1/2" data-testid="billing-address-summary">
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">
                    ที่อยู่สำหรับออกใบเสร็จ/ใบกำกับภาษี
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.first_name} {cart.billing_address.last_name}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.address_1}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.postal_code}, {cart.billing_address.city}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.country_code?.toUpperCase()}
                  </Text>
                </div>
                <div className="flex flex-col w-1/2" data-testid="billing-contact-summary">
                  <Text className="txt-medium-plus text-ui-fg-base mb-1">ข้อมูลติดต่อ</Text>
                  <Text className="txt-medium text-ui-fg-subtle">
                    {cart.billing_address.phone}
                  </Text>
                  <Text className="txt-medium text-ui-fg-subtle">{cart.email}</Text>
                </div>
              </div>
            ) : cart && cart.shipping_address ? (
              <div className="flex items-start gap-x-8">
                <div className="flex items-start gap-x-1 w-full">
                  <div
                    className="flex flex-col w-1/3"
                    data-testid="shipping-address-summary"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">
                      ที่อยู่จัดส่ง
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.first_name}{" "}
                      {cart.shipping_address.last_name}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.address_1}{" "}
                      {cart.shipping_address.address_2}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.postal_code},{" "}
                      {cart.shipping_address.city}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.country_code?.toUpperCase()}
                    </Text>
                  </div>

                  <div
                    className="flex flex-col w-1/3 "
                    data-testid="shipping-contact-summary"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">
                      ข้อมูลติดต่อ
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.shipping_address.phone}
                    </Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {cart.email}
                    </Text>
                  </div>

                  <div
                    className="flex flex-col w-1/3"
                    data-testid="billing-address-summary"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">
                      ที่อยู่สำหรับออกใบเสร็จ
                    </Text>

                    {sameAsBilling ? (
                      <Text className="txt-medium text-ui-fg-subtle">
                        ใช้ที่อยู่เดียวกับที่อยู่จัดส่ง
                      </Text>
                    ) : (
                      <>
                        <Text className="txt-medium text-ui-fg-subtle">
                          {cart.billing_address?.first_name}{" "}
                          {cart.billing_address?.last_name}
                        </Text>
                        <Text className="txt-medium text-ui-fg-subtle">
                          {cart.billing_address?.address_1}{" "}
                          {cart.billing_address?.address_2}
                        </Text>
                        <Text className="txt-medium text-ui-fg-subtle">
                          {cart.billing_address?.postal_code},{" "}
                          {cart.billing_address?.city}
                        </Text>
                        <Text className="txt-medium text-ui-fg-subtle">
                          {cart.billing_address?.country_code?.toUpperCase()}
                        </Text>
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
