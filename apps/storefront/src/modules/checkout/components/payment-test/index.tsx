import { Badge } from "@modules/common/components/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">โปรดทราบ:</span> ใช้สำหรับทดสอบเท่านั้น
    </Badge>
  )
}

export default PaymentTest
