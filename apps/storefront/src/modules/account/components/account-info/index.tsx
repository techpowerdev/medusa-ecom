import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useEffect } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { useFormStatus } from "react-dom"

// ข้อความจาก server อาจยาว — Badge ของ shadcn เป็น whitespace-nowrap จึงต้องให้ตัดบรรทัดได้ (review SFUI-2: จอ 390px)
const MESSAGE_CLASS = "p-2 my-4 h-auto rounded-md whitespace-normal text-left"

type AccountInfoProps = {
  label: string
  currentInfo: string | React.ReactNode
  isSuccess?: boolean
  isError?: boolean
  errorMessage?: string
  clearState: () => void
  /** CORE-23b: ฟอร์มที่ submit ผ่าน onSubmit (ไม่ใช่ action) ส่ง pending มาเอง */
  isPending?: boolean
  children?: React.ReactNode
  'data-testid'?: string
}

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  isPending,
  errorMessage = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
  children,
  'data-testid': dataTestid
}: AccountInfoProps) => {
  const { state, close, toggle } = useToggleState()

  const formStatus = useFormStatus()
  const pending = isPending || formStatus.pending

  // CORE-23c (กฎข้อ 74c): เปิด panel ทันที — setTimeout เดิมทำให้ช่องยังอยู่ใต้ `inert` หลังกดแก้ไข (ค่าที่พิมพ์หาย)
  // ปุ่มเป็น type="button" เสมอ (เปลี่ยน type ระหว่าง click ทำให้ browser reset ฟอร์มตอนเปิด) — ยกเลิกจึง reset เอง
  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    clearState()
    if (state) {
      event.currentTarget.form?.reset()
    }
    toggle()
  }

  useEffect(() => {
    if (isSuccess) {
      close()
    }
  }, [isSuccess, close])

  return (
    // SFUI-3c (spec 09 กฎ 4a): root เป็น Collapsible ที่ควบคุมด้วย state เดิม — ปุ่มแก้ไขเป็น trigger (aria-expanded/aria-controls)
    // ไม่ส่ง onOpenChange: ปุ่มเปลี่ยน state เองใน handleToggle (reset ฟอร์ม/clearState) ตามเดิม
    <Collapsible open={state} className="text-small-regular" data-testid={dataTestid}>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="uppercase text-foreground">{label}</span>
          {/* CORE-23 (กฎข้อ 53): ชิดซ้ายแนวเดียวกับ label — justify-end ของ starter ทำให้ค่าที่สั้นกว่า label เยื้องขวา */}
          <div className="flex items-center flex-1 basis-0 justify-start gap-x-4">
            {typeof currentInfo === "string" ? (
              <span className="font-semibold" data-testid="current-info">{currentInfo}</span>
            ) : (
              currentInfo
            )}
          </div>
        </div>
        <div>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-[100px] min-h-[25px] py-1"
              onClick={handleToggle}
              type="button"
              data-testid="edit-button"
              data-active={state}
            >
              {state ? "ยกเลิก" : "แก้ไข"}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      {/* Success state — ไม่มีปุ่ม toggle จึงเป็น div ธรรมดา (กฎ 4a) */}
      <div
        className={cn(
          "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
          {
            "max-h-[1000px] opacity-100": isSuccess,
            "max-h-0 opacity-0": !isSuccess,
          }
        )}
        data-testid="success-message"
      >
        <Badge variant="outline" className={cn(MESSAGE_CLASS, "bg-green-100 text-green-700")}>
          <span>อัปเดต{label}เรียบร้อยแล้ว</span>
        </Badge>
      </div>

      {/* Error state */}
      <div
        className={cn(
          "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
          {
            "max-h-[1000px] opacity-100": isError,
            "max-h-0 opacity-0": !isError,
          }
        )}
        data-testid="error-message"
      >
        <Badge className={MESSAGE_CLASS} variant="destructive">
          <span>{errorMessage}</span>
        </Badge>
      </div>

      <CollapsibleContent
        // SFUI-3c (กฎ 4a): render ตลอด ซ่อน/แสดงด้วย class เดิม — forceMount ทำให้ Radix ไม่ใส่ `hidden` ตอนปิด (transition เดิมยังทำงาน)
        forceMount
        // CORE-22 (กฎข้อ 48): panel ที่ปิดต้องไม่รับ click/focus — ไม่งั้นปุ่มบันทึกที่มองไม่เห็นบัง editor ถัดไป
        inert={!state}
        className={cn(
            "transition-[max-height,opacity] duration-300 ease-in-out",
          {
            "max-h-[1000px] opacity-100 overflow-visible": state,
            "max-h-0 opacity-0 overflow-hidden pointer-events-none": !state,
          }
        )}
        data-testid="edit-panel"
        // core-22/AC-11 อ่าน data-open ไม่ใช่ data-state ของ Radix
        data-open={state}
      >
        <div className="flex flex-col gap-y-2 py-4">
          <div>{children}</div>
          <div className="flex items-center justify-end mt-2">
            <Button
              isLoading={pending}
              className="w-full small:max-w-[140px]"
              type="submit"
              data-testid="save-button"
            >
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default AccountInfo
