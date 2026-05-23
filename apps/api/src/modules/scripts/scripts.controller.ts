import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/auth.decorator";
import { ScriptsService } from "./scripts.service";

type JwtUser = { sub: string; email: string; name: string; role: string };

@Controller("scripts")
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.scriptsService.list({ q, status });
  }

  @Get(":id/preview")
  preview(@Param("id") id: string) {
    return this.scriptsService.preview(id);
  }

  @Post()
  create(@Body() body: { title: string; content: string; genre?: string }, @CurrentUser() user: JwtUser) {
    return this.scriptsService.create({ ...body, authorId: user.sub });
  }

  @Post(":id/lock")
  lock(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.scriptsService.lockForExclusiveUse(id, user.sub);
  }
}
