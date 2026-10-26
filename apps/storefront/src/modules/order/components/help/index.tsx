import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"

const Help = () => {
  return (
    <div className="mt-6" data-testid="order-help">
      <Heading className="text-base-semi">ต้องการความช่วยเหลือ?</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <LocalizedClientLink href="/contact" data-testid="order-help-contact-link">
              ติดต่อเรา
            </LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href="/returns" data-testid="order-help-returns-link">
              การคืนและเปลี่ยนสินค้า
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
