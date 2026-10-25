import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { evoucherApi, evoucherKeys, formatDate, STATUS_COLOR } from "../lib/evoucher"

// EV-6: ส่วน "E-vouchers" บนหน้า order — code ของ order แบบ masked
// (Medusa admin ไม่มี tab บนหน้า order จึงใช้ widget; ปุ่มส่งซ้ำรอ API resend ของ EV-5)
const OrderEvouchersWidget = ({ data: order }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const { data, isLoading } = useQuery({
    queryKey: evoucherKeys.orderCodes(order.id),
    queryFn: () => evoucherApi.listOrderCodes(order.id),
  })

  // order ที่ไม่มี voucher ไม่ต้องแสดงอะไร
  if (!isLoading && !data?.codes.length) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">E-vouchers</Heading>
      </div>
      {isLoading ? (
        <Text size="small" leading="compact" className="text-ui-fg-subtle px-6 py-4">
          Loading…
        </Text>
      ) : (
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
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details",
})

export default OrderEvouchersWidget
