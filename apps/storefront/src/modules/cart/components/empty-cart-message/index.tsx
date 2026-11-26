import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  return (
    <div className="py-48 px-2 flex flex-col justify-center items-start" data-testid="empty-cart-message">
      <h1 className="text-[2rem] leading-[2.75rem] font-semibold flex flex-row gap-x-2 items-baseline">
        ตะกร้าสินค้า
      </h1>
      <p className="text-sm leading-6 font-normal mt-4 mb-6 max-w-[32rem]">
        ยังไม่มีสินค้าในตะกร้า เลือกดูสินค้าของเราได้จากลิงก์ด้านล่าง
      </p>
      <div>
        <InteractiveLink href="/store">เลือกดูสินค้า</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
