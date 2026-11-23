"use client"

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react"
import { retrieveCart } from "@lib/data/cart"
import { CART_UPDATED_EVENT } from "@lib/util/cart-events"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Button, buttonClassName } from "@modules/common/components/ui"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useRef, useState } from "react"

const countItems = (cart?: HttpTypes.StoreCart | null) =>
  cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

const CartDropdown = ({
  cart: serverCart,
}: {
  cart?: HttpTypes.StoreCart | null
}) => {
  // Statically rendered pages can't read the cart cookie, so the cart is loaded in the browser.
  // CORE-72 (กฎข้อ 130): `undefined` = ยังโหลดไม่เสร็จ (ไม่รู้จำนวน) ต่างจาก `null` = ไม่มี cart จริง
  const [clientCart, setClientCart] = useState<
    HttpTypes.StoreCart | null | undefined
  >(undefined)
  // CORE-91 (กฎข้อ 147b): `serverCart` = `undefined` คือหน้า static (server ไม่รู้) ส่วน `null` = server รู้ว่าไม่มี cart
  const cartState = clientCart === undefined ? serverCart : serverCart ?? clientCart
  // CORE-77 (กฎข้อ 135): อ่านล้ม → เลิก busy (ป้าย "ตะกร้า" ไม่มีตัวเลข) แล้วอ่านใหม่ 1 ครั้งเมื่อ pathname เปลี่ยน
  const [loadFailed, setLoadFailed] = useState(false)
  const retryLoad = useRef<(() => void) | null>(null)
  const countUnknown = cartState === undefined
  const loading = countUnknown && !loadFailed
  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined
  )
  const [cartDropdownOpen, setCartDropdownOpen] = useState(false)

  const open = () => setCartDropdownOpen(true)
  const close = () => setCartDropdownOpen(false)

  const totalItems = countItems(cartState)

  // CORE-26 (กฎข้อ 81a): ยอดของสินค้าหลังส่วนลดและรวม VAT ที่ Medusa คำนวณ — ตรงกับราคาต่อ line ที่แสดง
  const itemTotal = cartState?.item_total ?? 0
  const itemRef = useRef<number>(totalItems || 0)

  useEffect(() => {
    if (serverCart) {
      return
    }

    // server รู้ว่าไม่มี cart → ไม่อ่านซ้ำตอน mount แต่ยังอ่านเมื่อ cart ถูกแก้ (event)
    const serverKnows = serverCart === null
    let isInitialLoad = !serverKnows
    // `fresh`: this runs right after a cart mutation, before Next has applied its cache revalidation.
    const load = () =>
      retrieveCart(undefined, undefined, { fresh: true })
        .then((cart) => {
          if (isInitialLoad) {
            // Don't auto-open the dropdown for items that were already in the cart.
            itemRef.current = countItems(cart)
            isInitialLoad = false
          }
          setClientCart(cart)
          setLoadFailed(false)
        })
        .catch(() => setLoadFailed(true))

    if (!serverKnows) {
      load()
    }
    retryLoad.current = load
    window.addEventListener(CART_UPDATED_EVENT, load)
    return () => {
      retryLoad.current = null
      window.removeEventListener(CART_UPDATED_EVENT, load)
    }
  }, [serverCart])

  const timedOpen = () => {
    open()

    const timer = setTimeout(close, 5000)

    setActiveTimer(timer)
  }

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer)
    }

    open()
  }

  // Clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (activeTimer) {
        clearTimeout(activeTimer)
      }
    }
  }, [activeTimer])

  const pathname = usePathname()

  // อ่านใหม่เฉพาะตอน pathname เปลี่ยนขณะอ่านล้มอยู่ — ไม่วนซ้ำ ไม่ตั้ง timer และไม่ยิงเพิ่มเมื่ออ่านสำเร็จแล้ว
  const lastPathname = useRef(pathname)
  useEffect(() => {
    if (lastPathname.current === pathname) {
      return
    }
    lastPathname.current = pathname
    if (loadFailed) {
      retryLoad.current?.()
    }
  }, [pathname, loadFailed])

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current])

  return (
    // CORE-26 (กฎข้อ 81c): ชี้ที่ปุ่มตะกร้าเท่านั้นที่ยกเลิกการปิดเอง — panel ที่เปิดเองทับปุ่มที่ลูกค้าเพิ่งกด
    // จึงต้องปิดเองใน 5 วินาทีแม้ mouse ค้างอยู่ใต้ panel
    <div className="h-full z-50" onMouseLeave={close}>
      <Popover className="relative h-full">
        <PopoverButton className="h-full" onMouseEnter={openAndCancel}>
          <LocalizedClientLink
            className="hover:text-ui-fg-base whitespace-nowrap"
            href="/cart"
            data-testid="nav-cart-link"
            aria-busy={loading || undefined}
          >
            {countUnknown ? "ตะกร้า" : `ตะกร้า (${totalItems})`}
          </LocalizedClientLink>
        </PopoverButton>
        <Transition
          show={cartDropdownOpen}
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
        >
          <PopoverPanel
            static
            className="hidden small:block absolute top-[calc(100%+1px)] right-0 bg-white border-x border-b border-gray-200 w-[420px] text-ui-fg-base"
            data-testid="nav-cart-dropdown"
          >
            <div className="p-4 flex items-center justify-center">
              <h3 className="text-large-semi">ตะกร้า</h3>
            </div>
            {countUnknown ? (
              // CORE-91 (กฎข้อ 147a): ยังไม่รู้ (กำลังโหลด/อ่านล้ม) → ไม่บอกว่าตะกร้าว่าง
              <div className="flex py-16 flex-col gap-y-4 items-center justify-center">
                {loading ? (
                  <span data-testid="nav-cart-dropdown-loading" aria-busy="true">
                    กำลังโหลดตะกร้า…
                  </span>
                ) : (
                  <>
                    <span data-testid="nav-cart-dropdown-error">
                      ยังโหลดตะกร้าไม่ได้
                    </span>
                    <LocalizedClientLink
                      href="/cart"
                      className={buttonClassName()}
                    >
                      ดูตะกร้า
                    </LocalizedClientLink>
                  </>
                )}
              </div>
            ) : cartState && cartState.items?.length ? (
              <>
                <div className="overflow-y-scroll max-h-[402px] px-4 grid grid-cols-1 gap-y-8 no-scrollbar p-px">
                  {cartState.items
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => (
                      <div
                        className="grid grid-cols-[122px_1fr] gap-x-4"
                        key={item.id}
                        data-testid="cart-item"
                      >
                        <LocalizedClientLink
                          href={`/products/${item.product_handle}`}
                          className="w-24"
                        >
                          <Thumbnail
                            thumbnail={item.thumbnail}
                            images={item.variant?.product?.images}
                            size="square"
                          />
                        </LocalizedClientLink>
                        <div className="flex flex-col justify-between flex-1">
                          <div className="flex flex-col flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex flex-col overflow-ellipsis whitespace-nowrap mr-4 w-[180px]">
                                <h3 className="text-base-regular overflow-hidden text-ellipsis">
                                  <LocalizedClientLink
                                    href={`/products/${item.product_handle}`}
                                    data-testid="product-link"
                                  >
                                    {item.title}
                                  </LocalizedClientLink>
                                </h3>
                                <LineItemOptions
                                  variant={item.variant}
                                  data-testid="cart-item-variant"
                                  data-value={item.variant}
                                />
                                <span
                                  data-testid="cart-item-quantity"
                                  data-value={item.quantity}
                                >
                                  จำนวน: {item.quantity}
                                </span>
                              </div>
                              <div className="flex justify-end">
                                <LineItemPrice
                                  item={item}
                                  style="tight"
                                  currencyCode={cartState.currency_code}
                                />
                              </div>
                            </div>
                          </div>
                          <DeleteButton
                            id={item.id}
                            className="mt-1"
                            data-testid="cart-item-remove-button"
                          >
                            ลบ
                          </DeleteButton>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="p-4 flex flex-col gap-y-4 text-small-regular">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-ui-fg-base font-semibold"
                      data-testid="cart-subtotal-label"
                    >
                      ยอดรวมสินค้า{" "}
                      {/* eslint-disable-next-line no-restricted-syntax -- "VAT" เป็นคำย่อที่ลูกค้าไทยใช้ ป้ายตาม Q-C1 ที่ owner ตัดสิน (spec 01 กฎข้อ 81a) */}
                      <span className="font-normal">(รวม VAT)</span>
                    </span>
                    <span
                      className="text-large-semi"
                      data-testid="cart-subtotal"
                      data-value={itemTotal}
                    >
                      {convertToLocale({
                        amount: itemTotal,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink
                    href="/cart"
                    className={buttonClassName({ size: "large" }, "w-full")}
                    data-testid="go-to-cart-button"
                  >
                    ไปที่ตะกร้า
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div>
                <div className="flex py-16 flex-col gap-y-4 items-center justify-center">
                  <div className="bg-gray-900 text-small-regular flex items-center justify-center w-6 h-6 rounded-full text-white">
                    <span>0</span>
                  </div>
                  <span>ตะกร้าของคุณยังว่างอยู่</span>
                  <div>
                    <LocalizedClientLink href="/store">
                      <>
                        <span className="sr-only">ไปที่หน้าสินค้าทั้งหมด</span>
                        <Button onClick={close}>เลือกดูสินค้า</Button>
                      </>
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  )
}

export default CartDropdown
