import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreditsService } from "./credits.service";

@Controller("credits")
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get(":userId")
  balance(@Param("userId") userId: string) {
    return this.creditsService.balance(userId);
  }

  @Post(":userId/adjust")
  adjust(@Param("userId") userId: string, @Body() body: { amount: number; reason: string }) {
    return this.creditsService.adjust(userId, body.amount, body.reason);
  }
}
