import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge variant="outline" className={cn("bg-orange-100 text-orange-700", className)}>
      <span className="font-semibold">โปรดทราบ:</span> ใช้สำหรับทดสอบเท่านั้น
    </Badge>
  )
}

export default PaymentTest
