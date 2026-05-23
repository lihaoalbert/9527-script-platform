import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/auth.decorator";
import { CreditsService } from "./credits.service";

type JwtUser = { sub: string; email: string; name: string; role: string };

@Controller("credits")
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get()
  myBalance(@CurrentUser() user: JwtUser) {
    return this.creditsService.balance(user.sub);
  }

  @Get(":userId")
  balance(@Param("userId") userId: string) {
    return this.creditsService.balance(userId);
  }

  @Post(":userId/adjust")
  adjust(@Param("userId") userId: string, @Body() body: { amount: number; reason: string }) {
    return this.creditsService.adjust(userId, body.amount, body.reason);
  }
}
