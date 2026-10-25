import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { Resend } from "resend"
import { renderEmailTemplate } from "./templates"

// Notification Module Provider สำหรับ Resend ตาม guide ทางการของ Medusa
// https://docs.medusajs.com/resources/integrations/guides/resend

type InjectedDependencies = {
  logger: Logger
}

export type ResendOptions = {
  api_key: string
  from: string
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"

  protected resendClient_: Resend
  protected options_: ResendOptions
  protected logger_: Logger

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super()
    this.resendClient_ = new Resend(options.api_key)
    this.options_ = options
    this.logger_ = logger
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the Resend provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the Resend provider's options."
      )
    }
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const email = renderEmailTemplate(notification.template, notification.data ?? {})

    // throw แทนการ return {} เพื่อให้ Notification Module บันทึก status=failure (ส่งซ้ำได้ด้วย idempotency_key เดิม)
    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No Resend email template found for "${notification.template}"`
      )
    }

    const { data, error } = await this.resendClient_.emails.send({
      from: notification.from || this.options_.from,
      to: [notification.to],
      subject: email.subject,
      html: email.html,
    })

    if (error || !data) {
      this.logger_.error(`Resend failed to send "${notification.template}": ${error?.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend failed to send email: ${error?.message ?? "unknown error"}`
      )
    }

    return { id: data.id }
  }
}

export default ResendNotificationProviderService
