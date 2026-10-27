import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { evoucherApi, evoucherKeys, formatDate, STATUS_COLOR } from "../lib/evoucher"
import { canResendEvouchers, resendErrorMessage } from "../lib/evoucher-resend"

// EV-6: ส่วน "E-vouchers" บนหน้า order — code ของ order แบบ masked
// (Medusa admin ไม่มี tab บนหน้า order จึงใช้ widget) + ปุ่มส่งอีเมลซ้ำ (EV-5b)
const OrderEvouchersWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: evoucherKeys.orderCodes(order.id),
    queryFn: () => evoucherApi.listOrderCodes(order.id),
  })

  // กันกดซ้ำ (กฎข้อ 11): ref กันคลิกซ้อนใน tick เดียวก่อน isPending เป็น true; backend มี lock ต่อ order อีกชั้น
  const inFlight = useRef(false)
  const resend = useMutation({
    mutationFn: () => evoucherApi.resendOrderEmail(order.id),
    onSuccess: ({ code_count }) => {
      toast.success(`E-voucher email resent with ${code_count} code${code_count === 1 ? "" : "s"}`)
      queryClient.invalidateQueries({ queryKey: evoucherKeys.orderCodes(order.id) })
    },
    onError: (err: Error) => {
      toast.error(resendErrorMessage(err))
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  const onResend = () => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    resend.mutate()
  }

  // order ที่ไม่มี voucher ไม่ต้องแสดงอะไร (แต่ API ล้มต้องแสดง error ไม่ใช่ซ่อนเงียบ)
  if (!isLoading && !isError && !data?.codes.length) {
    return null
  }

  return (
    <Container className="divide-y p-0" data-testid="evoucher-order-widget">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">E-vouchers</Heading>
        {data && canResendEvouchers(data.codes) && (
          <Button
            size="small"
            variant="secondary"
            data-testid="evoucher-resend"
            disabled={resend.isPending}
            isLoading={resend.isPending}
            onClick={onResend}
          >
            Resend email
          </Button>
        )}
      </div>
      {isLoading ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          Loading…
        </Text>
      ) : isError ? (
        <Text size="small" leading="compact" className="text-ui-fg-error px-6 py-4">
          Could not load e-vouchers: {error.message}
        </Text>
      ) : (
        // EV-13 (AC-32): ตารางกว้างกว่าคอลัมน์ของหน้า → เลื่อนแนวนอนภายใน widget แทนการล้นขอบ
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Pool</Table.HeaderCell>
                <Table.HeaderCell>Code</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Delivered to</Table.HeaderCell>
                <Table.HeaderCell>Expires</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data!.codes.map((code) => (
                <Table.Row key={code.id}>
                  <Table.Cell>{code.pool?.name ?? "-"}</Table.Cell>
                  <Table.Cell className="font-mono">{code.code}</Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={STATUS_COLOR[code.status]}>
                      {code.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{code.delivered_to_email ?? "-"}</Table.Cell>
                  <Table.Cell>{formatDate(code.expires_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details",
})

export default OrderEvouchersWidget
