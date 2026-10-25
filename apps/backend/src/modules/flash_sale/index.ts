import { Module } from "@medusajs/framework/utils"
import FlashSaleModuleService from "./service"

export const FLASH_SALE_MODULE = "flash_sale"

export default Module(FLASH_SALE_MODULE, {
  service: FlashSaleModuleService,
})
